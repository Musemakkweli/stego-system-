# CYBERNESCENCE User Manual

## Overview
`stego-system` is a browser-based steganography app built with React. It lets users hide text and one selected file inside an image carrier, then extract hidden content later.

## Main Features
- Load an image carrier by drag/drop or file picker.
- Enter text in the editor and optionally encrypt it with a passphrase.
- Select a file to hide inside the image carrier.
- Create a stego image containing hidden payload.
- Download the generated stego image.
- Extract hidden data from a stego image.
- Decrypt hidden encrypted text on extraction.

## What Can Be Hidden
- Plain or encrypted text from the text editor.
- One selected file of any type.
- Hidden file data is stored as a Base64 data URL inside the secret payload.

## Important Notes
- Text encryption is optional and uses a password-based XOR-like scheme.
- Hidden files are not encrypted by the app; only text can be encrypted before hiding.
- The carrier image capacity is based on image dimensions and is shown once the image loads.
- If the secret content exceeds capacity, the app will alert you.

## How to Use

### 1. Load Carrier Image
- Use the left carrier panel.
- Drag & drop or click to select an image file.
- The app displays carrier dimensions and maximum character capacity.

### 2. Prepare Data
- Text:
  - Type or paste text in the editor.
  - Use `Encrypt Text` to encrypt text before hiding.
  - Use `Decrypt Text` to decrypt the current editor text.
  - Save or open `.txt` files with the `Open Text` / `Save Text` buttons.
- File:
  - Click `Select File` in the File to Hide section.
  - The selected file name is shown and image previews display if applicable.
  - Use `Purge` to clear the selected file or `Remove Data` to clear all text/file content.

### 3. Hide Data
- Click `Hide Data in Image`.
- The app packages the editor text and selected file into one hidden payload.
- If successful, it creates a `stego_image.png` and displays download/email options.

### 4. Download or Share
- Click `Download Stego Image` to save the output image.
- `Send by Email` opens the mail client with instructions to attach the downloaded file manually.

### 5. Extract Hidden Data
- In the Steganography panel, select a stego image file using the extraction file input.
- Click `Get Data`.
- The app shows:
  - The extracted stego image preview
  - Hidden text output
  - Hidden file preview or download link
- If hidden text was encrypted, it prompts for the password.

## UI Sections
- Carrier input and image upload
- Steganography actions: Hide Data / Get Data
- Text editor with clipboard controls
- Cryptography controls for encrypt/decrypt text
- File hide controls
- Extracted results panel
- Activity log with operation history
- Help, Close, and Exit buttons

## Run the App
From the project root:
- `npm install`
- `npm start`

## Code Notes
- Main logic lives in `src/App.js`
- App uses `react-scripts` and standard Create React App setup
- No backend needed; all encoding and extraction work in the browser
- `public/` and `build/` contain standard CRA static assets
