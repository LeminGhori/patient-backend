const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
require("dotenv").config();
const app = express();

const corsOptions = {
  origin: "https://font-end.dxblu.com",
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Body parser middleware for JSON with a larger limit
app.use(bodyParser.json({ limit: "50mb" }));

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
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Sheet1";

// Set up the public folder
// const PUBLIC_FOLDER = path.join("/var/www/patient-info-new", "public");
const PUBLIC_FOLDER = path.join("/", "public");
if (!fs.existsSync(PUBLIC_FOLDER)) {
  fs.mkdirSync(PUBLIC_FOLDER);
}

// Function to save base64 file
const saveBase64File = (base64String, fileName) => {
  try {
    // Extract base64 data and file type
    const matches = base64String.match(/^data:(.*?);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 format");
    }

    const fileType = matches[1]; // This is the MIME type of the file
    const fileData = matches[2]; // This is the actual base64 data to save

    // Determine file extension based on MIME type
    let extension = '';
    if (fileType === 'application/pdf') {
      extension = '.pdf';
    } else if (fileType === 'image/png') {
      extension = '.png';
    } else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
      extension = '.jpg'; // Handle both 'image/jpeg' and 'image/jpg'
    } else if (fileType === 'image/gif') {
      extension = '.gif';
    } else if (fileType === 'text/plain') {
      extension = '.txt';
    } else {
      throw new Error("Unsupported file type");
    }

    // Set the full file name with the appropriate extension
    const fullFileName = `${fileName}${extension}`;
    const filePath = path.join(PUBLIC_FOLDER, fullFileName); // Create the full path to save the file

    // Write the file to the public folder
    fs.writeFileSync(filePath, Buffer.from(fileData, "base64"));

    // Return the relative file path for Google Sheets
    return `/public/${fullFileName}`;
  } catch (error) {
    console.error("Error saving base64 file:", error);
    throw error; // Rethrow the error to be caught by the API
  }
};

// API to append a row
app.post("/api/add-patient", async (req, res) => {
  const payload = req.body;

  try {
    // Generate a unique patientNumber
    const patientNumber = `PAT-${Date.now()}`;

    // Define header mapping
    const headerMapping = {
      patientNumber: "Patient Number",
      campLocation: "Camp Location",
      hostipalName:"Hostipal Name",
      currentDate: "Current Date",
      location: "Location",
      name: "Name",
      DOB: "Date of Birth",
      gender: "Gender",
      id: "Patient ID",
      tobaccoUsage: "Tobacco Usage (Y/N)",
      "tobaccoDetails.type": "Tobacco Type",
      "tobaccoDetails.frequency": "Tobacco Frequency",
      "tobaccoDetails.years": "Tobacco Usage Years",
      oralFindings: "Oral Findings",
      oralFindingsDocument: "Oral Findings Document URL",
      dxBluResult: "DX Blu Result",
      dxBluResultDocument: "DX Blu Result Document URL",
      dxBluInterpretation: "DX Blu Interpretation",
      recommendation: "Recommendation",
      biopsyStatus: "Biopsy Status",
      biopsyStatusDocument: "Biopsy Status Document URL",
      biopsyResult: "Biopsy Result URL",
      phoneNumber: "Phone Number",
    };

    // Save base64 files and get their URLs
    const fileLinks = {
      oralFindingsDocument: payload.oralFindingsDocument
        ? saveBase64File(
            payload.oralFindingsDocument,
            `${patientNumber}_oralFindingsDocument`
          )
        : "",
      dxBluResultDocument: payload.dxBluResultDocument
        ? saveBase64File(
            payload.dxBluResultDocument,
            `${patientNumber}_dxBluResultDocument`
          )
        : "",
      biopsyStatusDocument: payload.biopsyStatusDocument
        ? saveBase64File(
            payload.biopsyStatusDocument,
            `${patientNumber}_biopsyStatusDocument`
          )
        : "",
      biopsyResult: payload.biopsyResult
        ? saveBase64File(
            payload.biopsyResult,
            `${patientNumber}_biopsyResult`
          )
        : "",
    };

    // Map payload to match header keys
    const headerKeys = Object.keys(headerMapping);
    const rowData = headerKeys.map((key) => {
      if (key === "patientNumber") {
        return patientNumber; // Include the generated patientNumber
      } else if (fileLinks[key]) {
        return `https://font-end.dxblu.com/${fileLinks[key]}`; // Include file URLs
      }

      const keys = key.split(".");
      return keys.reduce((acc, cur) => (acc ? acc[cur] : ""), payload) || "";
    });

    // Check if the sheet already has headers
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:Z1`,
    });

    if (!existingData.data.values || existingData.data.values.length === 0) {
      // If header row doesn't exist, create it with user-friendly names
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: [Object.values(headerMapping)], // Insert the user-friendly names
        },
      });
    }

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
      patientNumber, // Return the generated patientNumber in the response
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
