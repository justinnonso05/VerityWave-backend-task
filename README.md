# VerityWave Backend Task

This repository contains the backend implementation for the VerityWave assessment. It provides an API for handling media uploads (images and videos), performing optimization, and interacting with a database to record metadata.

## Structural and Architectural Decisions

### 1. Smart Split-Pipeline Media Processing
Media processing was architected to balance performance, scalability, and engineering simplicity by using a split-pipeline approach based on the `MIME` type:

*   **Images (`image/*`):** Processed and compressed locally within the Node.js service using `sharp`. This reduces the buffer size in-memory before it hits network transit, optimizing storage and bandwidth.
*   **Videos (`video/*`):** Video compression using native tools like FFmpeg or WebAssembly (`@ffmpeg/ffmpeg`) is inherently CPU-bound. Processing this synchronously in Node.js would block the event loop, causing server lag and potential HTTP timeouts for scaling requests. To prevent this, video compression is intentionally **offloaded to Cloudinary**. The raw buffer is streamed directly to Cloudinary, ensuring the server stays lightweight, performant, and highly available for subsequent API requests.

### 2. In-Memory Storage (`multer.memoryStorage()`)
Instead of persisting temporary files to the disk and needing a cron job or cleanup routine to delete them, the application stores incoming files temporarily in memory (`Buffer`). The buffer is immediately processed (or streamed directly) and garbage collected, minimizing disk I/O operations and disk space exhaustion risks.

### 3. External API for Storage & Optimization (Cloudinary)
Cloudinary is leveraged as an external Blob Storage and Optimization layer. Its `quality='auto', fetch_format='auto'` transforms are utilized during the upload stream. For videos, Cloudinary entirely shoulders the optimization process. This handles the complex problem of adaptive bitrate streaming and scalable video storage without custom local infrastructure overhead.

### 4. Graceful Fallbacks (Silent Failures)
The primary objective of the API is to **analyze** the file (generating a report score and recording it). Thus, media optimization and upload phases are built to fail gracefully:
*   **Image Compression Failure:** If `sharp` fails due to unsupported codecs or corrupted headers, the system catches the error and silently attempts to write the raw, uncompressed buffer to the local disk instead, saving the original file so the analysis isn't disrupted.
*   **Video Cloudinary Failure:** If Cloudinary limits are reached, network timeouts occur, or credentials expire, the API avoids returning a `500 Server Error`. Instead, it skips the video persistence phase, sets the file path to explicitly indicate the failure (`cloudinary_upload_failed`), and still yields a successful Mock Analysis response to the client. This guarantees critical business logic (assessment generation) works independently of external vendor limits.

### 5. Database Toolkit
Prisma ORM is used with SQLite (via `better-sqlite3`). Prisma provides strong typings and migrations out of the box, making database interactions extremely robust down to the service layer.

### 6. Standardized API Response Envelope
To ensure highly predictable integration for any frontend consumers, the API implements a standardized uniform JSON envelope. It utilizes a custom `ApiResponse` wrapper for successes and an `ApiError` class combined with middleware for failures. Every endpoint guarantees a `success` boolean, a human-readable `message`, and an optional `data` payload or errors trace. This design simplifies client-side parsing and global error handling dramatically.

---

## Technical Stack
*   **Node.js & Express.js**
*   **TypeScript** (Compiled to ES modules)
*   **Prisma ORM** (`@prisma/client`) with **SQLite**
*   **Multer** (Memory Storage)
*   **Sharp** (Local image processing)
*   **Cloudinary** (Cloud storage and video optimization processing)

---

## Setup Instructions

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Create a `.env` file in the root directory based on the following pattern:
    ```env
    DATABASE_URL="file:./dev.db"
    CLOUDINARY_CLOUD_NAME="your-cloud-name"
    CLOUDINARY_API_KEY="your-api-key"
    CLOUDINARY_API_SECRET="your-api-secret"
    ```

3.  **Generate Prisma client:**
    ```bash
    npx prisma generate
    ```

4.  **Start Development Server:**
    ```bash
    npm run dev
    ```
    *Build for production with `npm run build` and start with `npm start`.*

---

## Troubleshooting

### Better-SQLite3 Native Bindings Error
If you clone this project on a new PC or switch Node.js versions, you might encounter an error stating `Error: Could not locate the bindings file` for `better-sqlite3`. This happens because `better-sqlite3` uses native C++ bindings compiled specifically for your operating system and Node version.

**To fix this, run:**
```bash
npm rebuild better-sqlite3
```
If that fails (due to missing C++ build tools on Windows), completely wipe and reinstall dependencies:
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

---

## API Documentation

**Postman Documentation Reference:**  
[VerityWave API Documentation (Postman)](https://documenter.getpostman.com/view/36406749/2sBXqMHeWr)

### 1. Upload and Analyze Media

Uploads a media file (Image or Video), optimizes it according to the smart-split architecture, uploads to Cloudinary, generates an analysis score, and saves the record to the database.

*   **Endpoint:** `/analyze`
*   **Method:** `POST`
*   **Content-Type:** `multipart/form-data`

**Request Payload:**
*   `file` (File, required): The image or video file to be uploaded.
    *   Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime`.
    *   Max File Size: 100MB

**Success Response (200 OK or 201 Created):**
```json
{
    "success": true,
    "message": "File analyzed successfully",
    "data": [
        {
            "id": "9fc5c058-f8d1-40b1-b254-b9a98799ae36",
            "fileName": "8Kwallpaper_uislides_seyiezekiel70.jpg",
            "fileType": "image/jpeg",
            "score": 41,
            "isAIGenerated": false,
            "filePath": "compressed-1777789154773-8Kwallpaper_uislides_seyiezekiel70.jpg",
            "createdAt": "2026-05-03T06:19:14.897Z"
        }
    ]
}
```

---

### 2. Get Analysis History

Retrieves a chronologically ordered list (newest first) of all past uploaded media and their analysis results.

*   **Endpoint:** `/history`
*   **Method:** `GET`

**Success Response (200 OK):**
```json
{
    "success": true,
    "message": "History retrieved successfully",
    "data": [
        {
            "id": "e12f193f-72aa-4d31-becd-b913677ac9c2",
            "fileName": "ChatGPT - Landmark - Google Chrome 2025-10-11 21-47-41.mp4",
            "fileType": "video/mp4",
            "score": 0,
            "isAIGenerated": false,
            "filePath": "https://res.cloudinary.com/dpyxbvcyl/video/upload/v1777889610/veritywave_test/sa5xxmjmaskx83ewpthj.mp4",
            "createdAt": "2026-05-04T10:13:34.207Z"
        },
        {
            "id": "536848ef-ce9c-4c1a-bdfa-64cb6ac9b7e9",
            "fileName": "vsdc-sr 2025-01-24 18-50-25.mp4",
            "fileType": "video/mp4",
            "score": 4,
            "isAIGenerated": false,
            "filePath": "compressed-1777790656835-vsdc-sr 2025-01-24 18-50-25.mp4",
            "createdAt": "2026-05-03T06:44:34.465Z"
        },
        {
            "id": "87971fcd-4d7c-46ba-93b8-de710c12c7eb",
            "fileName": "Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "fileType": "video/mp4",
            "score": 45,
            "isAIGenerated": false,
            "filePath": "compressed-1777789545500-Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "createdAt": "2026-05-03T06:25:45.599Z"
        },
        {
            "id": "cac2c27e-fddf-4338-ae06-62a81b4d78dc",
            "fileName": "Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "fileType": "video/mp4",
            "score": 16,
            "isAIGenerated": false,
            "filePath": "compressed-1777789540115-Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "createdAt": "2026-05-03T06:25:40.215Z"
        },
        {
            "id": "8da476c9-aafb-4c01-9ee0-15173eee57f3",
            "fileName": "Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "fileType": "video/mp4",
            "score": 54,
            "isAIGenerated": false,
            "filePath": "compressed-1777789535017-Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "createdAt": "2026-05-03T06:25:35.111Z"
        },
        {
            "id": "f658787f-13b7-4d25-8cec-e1e3c1c68ea7",
            "fileName": "Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "fileType": "video/mp4",
            "score": 16,
            "isAIGenerated": false,
            "filePath": "compressed-1777789529218-Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "createdAt": "2026-05-03T06:25:29.325Z"
        },
        {
            "id": "9714eeb8-54f6-4a80-9f84-351dcf2110e1",
            "fileName": "Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "fileType": "video/mp4",
            "score": 13,
            "isAIGenerated": false,
            "filePath": "compressed-1777789496611-Deploy a Django web app to Python Anywhere FREE_1080pFHR.mp4",
            "createdAt": "2026-05-03T06:24:58.252Z"
        },
        {
            "id": "9fc5c058-f8d1-40b1-b254-b9a98799ae36",
            "fileName": "8Kwallpaper_uislides_seyiezekiel70.jpg",
            "fileType": "image/jpeg",
            "score": 41,
            "isAIGenerated": false,
            "filePath": "compressed-1777789154773-8Kwallpaper_uislides_seyiezekiel70.jpg",
            "createdAt": "2026-05-03T06:19:14.897Z"
        }
    ]
}
```