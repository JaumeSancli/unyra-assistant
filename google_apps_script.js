function doPost(e) {
    // 1. Parse Input
    var data;
    try {
        data = JSON.parse(e.postData.contents);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid JSON" }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Route Action
    var action = data.action; // 'append', 'update', 'get_tickets'
    var sheetId = "YOUR_SPREADSHEET_ID_HERE"; // <--- CAMBIA ESTO O PASALO EN 'data'
    if (data.spreadsheet_id) sheetId = data.spreadsheet_id;

    var ss = SpreadsheetApp.openById(sheetId);
    var result = { ok: false };

    try {
        if (action === 'append') {
            result = appendTicket(ss, data.payload);
        } else if (action === 'update') {
            result = updateTicket(ss, data.payload);
        } else if (action === 'get_tickets') {
            result = getTickets(ss, data.email);
        } else {
            result = { ok: false, error: "Unknown action" };
        }
    } catch (err) {
        result = { ok: false, error: err.toString() };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// --- Helper Functions ---

function appendTicket(ss, rowData) {
    var sheet = ss.getSheetByName('Tickets') || ss.insertSheet('Tickets');

    // Headers check (optional, auto-create if empty)
    if (sheet.getLastRow() === 0) {
        sheet.appendRow([
            "Ticket ID", "Created At", "Requester", "Email", "Location", "Area",
            "Severity", "Subject", "Description", "Priority", "Status",
            "Unyra Task ID", "Task Error", "Attachments"
        ]);
    }

    // Generate Ticket ID
    var ticketId = "TCK-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

    sheet.appendRow([
        ticketId,
        rowData.created_at,
        rowData.requester_name,
        rowData.requester_email,
        rowData.location_name,
        rowData.area,
        rowData.severity,
        rowData.subject,
        rowData.description,
        rowData.priority_score,
        rowData.status || 'new',
        rowData.unyra_task_id || '',
        rowData.task_error || '',
        rowData.attachments || '[]'
    ]);

    return {
        ok: true,
        ticket_id: ticketId,
        row_id: sheet.getLastRow().toString(),
        sheet_url: ss.getUrl()
    };
}

function updateTicket(ss, payload) {
    var sheet = ss.getSheetByName('Tickets');
    if (!sheet) return { ok: false, error: "Sheet 'Tickets' not found" };

    // Simple search by Ticket ID (Column A)
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;

    // Assuming payload provided row_id, check match; OR search by ID
    // If row_id is reliable (row number), use it directly (minus 1 for 0-index if data includes header)
    // Let's rely on finding by Ticket ID for safety if possible, or just exact row index if passed.

    // Strategy: payload.row_id corresponds to the actual sheet row number
    var r = parseInt(payload.row_id);
    if (r > 0 && r <= sheet.getLastRow()) {
        // Validate it might be the right ticket? skipping for simplicity

        // Unyra Task ID is col 12 (index 11), Status col 11 (index 10), Task Error col 13 (index 12)
        // Columns are 1-based in getRange
        if (payload.patch.status) sheet.getRange(r, 11).setValue(payload.patch.status);
        if (payload.patch.unyra_task_id) sheet.getRange(r, 12).setValue(payload.patch.unyra_task_id);
        if (payload.patch.task_error) sheet.getRange(r, 13).setValue(payload.patch.task_error);

        return { ok: true };
    }

    return { ok: false, error: "Row not found" };
}

function getTickets(ss, email) {
    var sheet = ss.getSheetByName('Tickets');
    if (!sheet) return { ok: true, tickets: [] }; // No sheet = no tickets

    var data = sheet.getDataRange().getValues();
    var tickets = [];

    // Skip header, start i=1
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        // Filter by email if provided, index 3
        if (!email || (row[3] && row[3].toString().toLowerCase() === email.toLowerCase())) {
            tickets.push({
                ticket_id: row[0],
                date: row[1],
                subject: row[7],
                status: row[10],
                unyra_task: row[11]
            });
        }
    }

    return { ok: true, tickets: tickets };
}
