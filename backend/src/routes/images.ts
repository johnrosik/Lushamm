import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { ImageCompressionService } from '../services/imageCompressionService';

const router = Router();

// Configuração do Multer
const upload = multer({
  dest: './temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'));
    }
  }
});

// Criar diretórios
const ensureDirectories = async () => {
  try {
    await fs.mkdir('./temp', { recursive: true });
    await fs.mkdir('./uploads/images', { recursive: true });
    await fs.mkdir('./uploads/thumbnails', { recursive: true });
  } catch (error) {
    console.error('Erro ao criar diretórios:', error);
  }
};

ensureDirectories();

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Upload de imagem única
router.post('/upload/single', upload.single('image'), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada' });
    }

    const tempPath = req.file.path;
    const originalName = req.file.originalname;
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const outputPath = `./uploads/images/${fileName}.jpg`;

    // Comprimir imagem
    const compressionResult = await ImageCompressionService.compressImage(
      tempPath,
      outputPath,
      {
        maxFileSizeMB: 1, // 1MB máximo
        quality: 80,
        maxWidth: 1920,
        maxHeight: 1080
      }
    );

    // Limpar arquivo temporário
    await fs.unlink(tempPath);

    if (!compressionResult.success) {
      return res.status(500).json({
        error: 'Erro ao processar a imagem',
        details: compressionResult.error
      });
    }

    return res.json({
      success: true,
      message: 'Imagem enviada e processada com sucesso',
      file: {
        originalName: originalName,
        fileName: `${fileName}.jpg`,
        originalSize: `${(compressionResult.originalSize / 1024 / 1024).toFixed(2)} MB`,
        compressedSize: `${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)} MB`,
        compressionRatio: `${compressionResult.compressionRatio.toFixed(2)}x`,
        dimensions: compressionResult.dimensions,
        url: `/api/images/${fileName}.jpg`,
        format: compressionResult.format
      }
    });

  } catch (error) {
    console.error('Erro no upload de imagem:', error);
    
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Erro ao limpar arquivo temporário:', cleanupError);
      }
    }

    return res.status(500).json({
      error: 'Erro interno do servidor no upload de imagem'
    });
  }
});

// Buscar imagem
router.get('/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join('./uploads/images', filename);

    try {
      await fs.access(imagePath);
    } catch {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    return res.sendFile(path.resolve(imagePath));

  } catch (error) {
    console.error('Erro ao buscar imagem:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;