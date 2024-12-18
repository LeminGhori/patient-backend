// Import necessary modules
const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid"); // To generate unique IDs

const app = express();

// Enable CORS
app.use(cors());

// Set up file upload limits (40MB)
const upload = multer({
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB
}).single("image"); // assuming 'image' is the field name for file upload

// Body parser middleware for JSON with a larger limit
app.use(bodyParser.json({ limit: "50mb" })); // Set a larger limit for JSON bodies

// Load Google Service Account credentials
const KEYFILEPATH = path.join(__dirname, "/service-account-file.json");
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

// Function to generate a unique patient number
function generateUniquePatientNumber() {
  return `PN-${Date.now()}-${uuidv4().slice(0, 8)}`; // Combines timestamp and UUID for uniqueness
}

// Utility to get nested values from an object
function getValueFromNestedObject(payload, key) {
  const keys = key.split(".");
  return keys.reduce((obj, currentKey) => (obj && obj[currentKey] ? obj[currentKey] : ""), payload);
}

// API to append a row
app.post("/api/add-patient", upload, async (req, res) => {
  const payload = req.body;

  try {
    // Step 1: Get existing headers from the Google Sheet
    const existingHeadersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:Z1`, // Adjust the range as needed for the expected number of columns
    });

    let existingHeaders = existingHeadersResponse.data.values
      ? existingHeadersResponse.data.values[0]
      : [];

    // Step 2: Check if any keys in the payload are missing from the headers
    const payloadKeys = [
      "patientNumber", // Will be dynamically generated
      "currentDate",
      "location",
      "name",
      "id",
      "DOB",
      "gender",
      "tobaccoUsage",
      "tobaccoDetails.type",
      "tobaccoDetails.frequency",
      "tobaccoDetails.years",
      "oralFindings",
      "oralFindingsDocument",
      "dxBluResult",
      "dxBluResultDocument",
      "dxBluInterpretation",
      "recommendation",
      "biopsyStatus",
      "biopsyStatusDocument",
      "biopsyResult",
    ];

    const newHeaders = payloadKeys.filter((key) => !existingHeaders.includes(key));

    // Step 3: Append new headers to the first row if any are missing
    if (newHeaders.length > 0) {
      existingHeaders = [...existingHeaders, ...newHeaders];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: [existingHeaders],
        },
      });
    }

    // Step 4: Prepare row data
    const rowData = existingHeaders.map((header) => {
      if (header === "patientNumber") {
        return generateUniquePatientNumber(); // Generate unique patient number
      }
      if (header === "imageUrl") {
        return req.file ? `https://your-storage-url/${req.file.filename}` : ""; // Handle image URL
      }

      // Handle nested fields in payload (e.g., "tobaccoDetails.type")
      return getValueFromNestedObject(payload, header);
    });

    // Step 5: Append the row to the Google Sheet
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
