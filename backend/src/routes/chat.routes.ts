import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import {
  getAvailableUsers,
  getConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
  getUnreadCount,
  deleteMessage,
  pinMessage,
  forwardMessage,
  getChatNotifications,
  markAllNotificationsRead,
  createGroupConversation,
  updateGroupTheme,
  getUserTheme,
  updateUserTheme,
  getCallHistory,
} from '../controllers/chat.controller';

const router = Router();

// Configure multer storage for chat attachments
const uploadDir = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, safeName);
  },
});

const allowedMimeTypes = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/ogg',
  'video/3gpp',
  'video/x-matroska',
  // Audio & Voice Recordings
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'audio/x-m4a',
  'audio/opus',
  // PDFs & Office Documents
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/pdf',
  'text/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/comma-separated-values',
  'application/rtf',
  'application/x-rtf',
  'text/richtext',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream',
];

const allowedExtensions = [
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.rtf',
  '.zip',
  '.rar',
  '.7z',
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.bmp',
  '.ico',
  // Videos
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.m4v',
  '.3gp',
  '.mpeg',
  // Audio
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.opus',
  '.weba',
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max (supports videos and large docs)
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = allowedExtensions.includes(ext);
    const isAllowedMime =
      allowedMimeTypes.includes(file.mimetype) ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('image/');

    if (isAllowedMime || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype || ext}" is not supported. Permitted formats: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), PowerPoint, Text, CSV, Images, Videos, Audio.`));
    }
  },
});

// All chat routes require authentication
router.use(authenticate);

// Contacts & Conversations
router.get('/users', getAvailableUsers);
router.get('/conversations', getConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/read', markConversationAsRead);
router.get('/unread-count', getUnreadCount);
router.delete('/messages/:id', deleteMessage);
router.patch('/messages/:id/pin', pinMessage);
router.post('/messages/:id/forward', forwardMessage);

// Group Management & Themes (Admin Controlled)
router.post('/groups', createGroupConversation);
router.put('/groups/:id/theme', updateGroupTheme);

// User Personal Theme Settings
router.get('/theme', getUserTheme);
router.put('/theme', updateUserTheme);

// Call History
router.get('/calls/history', getCallHistory);

// Notifications
router.get('/notifications', getChatNotifications);
router.post('/notifications/mark-all-read', markAllNotificationsRead);

// Upload attachment with explicit error catching
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds 50MB limit.',
        });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file received in upload payload' });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  });
});

// Download attachment with original filename & proper Content-Disposition
router.get('/download/:filename', (req, res) => {
  try {
    const rawFilename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, rawFilename);
    const requestedName = (req.query.name as string) || rawFilename;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.download(filePath, requestedName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, message: 'Could not download file' });
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Download failed' });
  }
});

// View attachment inline (for previewing images, PDFs, etc.)
router.get('/view/:filename', (req, res) => {
  try {
    const rawFilename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, rawFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'File preview failed' });
  }
});

export default router;
