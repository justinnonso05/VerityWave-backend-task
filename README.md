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

### 4. Database Toolkit
Prisma ORM is used with SQLite (via `better-sqlite3`). Prisma provides strong typings and migrations out of the box, making database interactions extremely robust down to the service layer.

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

3.  **Run Database Migrations:**
    ```bash
    npx prisma migrate dev
    ```

4.  **Start Development Server:**
    ```bash
    npm run dev
    ```
    *Build for production with `npm run build` and start with `npm start`.*

---

## API Documentation

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
  "id": 1,
  "fileName": "example.png",
  "fileType": "image/png",
  "score": 75,
  "isAIGenerated": true,
  "filePath": "https://res.cloudinary.com/.../example.png",
  "createdAt": "2026-05-06T12:00:00.000Z",
  "updatedAt": "2026-05-06T12:00:00.000Z"
}
```

---

### 2. Get Analysis History

Retrieves a chronologically ordered list (newest first) of all past uploaded media and their analysis results.

*   **Endpoint:** `/history`
*   **Method:** `GET`

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "fileName": "example.png",
    "fileType": "image/png",
    "score": 75,
    "isAIGenerated": true,
    "filePath": "https://res.cloudinary.com/.../example.png",
    "createdAt": "2026-05-06T12:00:00.000Z",
    "updatedAt": "2026-05-06T12:00:00.000Z"
  },
  {
    "id": 2,
    "fileName": "video.mp4",
    "fileType": "video/mp4",
    "score": 30,
    "isAIGenerated": false,
    "filePath": "https://res.cloudinary.com/.../video.mp4",
    "createdAt": "2026-05-05T14:30:00.000Z",
    "updatedAt": "2026-05-05T14:30:00.000Z"
  }
]
```