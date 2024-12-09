const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();

// Enable CORS
app.use(cors());

// Set up file upload limits (40MB)
const upload = multer({
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB
}).single('image'); // assuming 'image' is the field name for file upload

// Body parser middleware for JSON with a larger limit
app.use(bodyParser.json({ limit: '50mb' })); // Set a larger limit for JSON bodies

// Body parser middleware for JSON
app.use(bodyParser.json());

// Load Google Service Account credentials
const KEYFILEPATH = path.join(__dirname, '/service-account-file.json');
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const sheets = google.sheets({ version: "v4", auth });

// Google Sheet details
const SPREADSHEET_ID = "18WG65s7p_Iav_jwnVFAMdX0uYc_JKAWRpGs-LQvdB7Q";
const SHEET_NAME = "Sheet1"; 

// API to append a row
app.post("/api/add-patient", upload, async (req, res) => {
  const payload = req.body;

  try {
    // Prepare row data
    const rowData = [
      payload.patientNumber,
      payload.currentDate,
      payload.location,
      payload.name,
      payload.age,
      payload.gender,
      req.file ? `https://your-storage-url/${req.file.filename}` : "", // Handle image URL (assuming you're storing the image in a folder or cloud storage)
      payload.tobaccoUsage,
      payload.tobaccoDetails.type,
      payload.tobaccoDetails.frequency,
      payload.tobaccoDetails.years,
      payload.oralFindings,
      payload.dxBluResult,
      payload.dxBluInterpretation,
      payload.recommendation,
      payload.biopsyStatus,
      payload.biopsyResult, 
    ];

    // Append the row to the Google Sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      resource: {
        values: [rowData],
      },
    });

    res.status(200).json({
      message: "Row added successfully",
      spreadsheetUpdate: response.data,
    });
  } catch (error) {
    console.error("Error adding row:", error);
    res.status(500).json({ message: "Error adding row", error });
  }
});

// Start the server
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
