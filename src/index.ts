import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";

const app = express();

// const uploadDir = "./uploads";
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir);
// }

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const uploadToCloudinary = (buffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "project_9_uploads",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
};

const fileFilterFunction = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: fileFilterFunction,
});

app.post("/upload", (req: Request, res: Response, next: NextFunction) => {
  upload.single("image")(req, res, async (err) => {

    if( err instanceof multer.MulterError){
      return res.status(400).json({error: `Multer error: ${err.message}`})   
    } else if(err) {
      return res.status(400).json({error: err.message})
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("File size in bytes: ", req.file.buffer.length);
      console.log("File mimetype: ", req.file.mimetype);

      const processedBuffer = await sharp(req.file.buffer)
        .resize({
          width: 300,
          height: 300,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      const optimizationRatio = req.file.buffer.length / processedBuffer.length;

      const cloudinaryResult = await uploadToCloudinary(processedBuffer);

      res.status(200).json({
        message: "File uploaded successfully",
        originalSize: req.file.buffer.length,
        processedSize: processedBuffer.length,
        optimizationRatio: optimizationRatio,
        url: cloudinaryResult.secure_url,
        public_id: cloudinaryResult.public_id,
      });
    } catch (error) {
      console.error("Upload error: ", error);
      return res
        .status(500)
        .json({ error: "Failed to process or upload image" });
    }
  });
});

app.listen(3000, () => {
  console.log("Server is active");
});
