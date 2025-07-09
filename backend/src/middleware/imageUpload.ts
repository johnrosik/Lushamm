/**
 * Middleware para upload e compressão automática de imagens
 * Integra Multer com o serviço de compressão
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { Request, Response, NextFunction } from 'express';
import { ImageCompressionService, ImageCompressionOptions } from '../services/imageCompressionService';

export interface UploadConfig {
    maxFileSize?: number; // em bytes
    allowedMimeTypes?: string[];
    uploadDir?: string;
    tempDir?: string;
    compression?: ImageCompressionOptions;
    variants?: boolean; // Se deve criar variantes (thumbnail, medium, etc.)
}

export interface ProcessedFile {
    original: {
        filename: string;
        path: string;
        size: number;
        mimetype: string;
    };
    compressed: {
        filename: string;
        path: string;
        size: number;
        compressionRatio: number;
        dimensions: { width: number; height: number };
    };
    variants?: Record<string, {
        filename: string;
        path: string;
        size: number;
        dimensions: { width: number; height: number };
    }>;
}

export class ImageUploadMiddleware {
    private static readonly DEFAULT_CONFIG: UploadConfig = {
        maxFileSize: 10 * 1024 * 1024, // 10MB para arquivo original
        allowedMimeTypes: [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/webp',
            'image/gif'
        ],
        uploadDir: './uploads/images',
        tempDir: './uploads/temp',
        compression: {
            maxFileSizeMB: 1,
            quality: 80,
            format: 'webp',
            maxWidth: 1920,
            maxHeight: 1080
        },
        variants: false
    };

    /**
     * Cria middleware de upload com compressão automática
     */
    static create(config: Partial<UploadConfig> = {}) {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

        // Configurar storage do multer para arquivos temporários
        const storage = multer.diskStorage({
            destination: async (req, file, cb) => {
                try {
                    await fs.mkdir(finalConfig.tempDir!, { recursive: true });
                    cb(null, finalConfig.tempDir!);
                } catch (error) {
                    cb(error as Error | null, '');
                }
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                cb(null, `temp-${uniqueSuffix}${ext}`);
            }
        });

        // Configurar filtros do multer
        const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
            if (finalConfig.allowedMimeTypes!.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Tipos permitidos: ${finalConfig.allowedMimeTypes!.join(', ')}`));
            }
        };

        const upload = multer({
            storage,
            fileFilter,
            limits: {
                fileSize: finalConfig.maxFileSize
            }
        });

        // Retornar middleware que processa o upload e comprime
        return {
            // Middleware para upload único
            single: (fieldName: string) => [
                upload.single(fieldName),
                this.processUploadedImages(finalConfig)
            ],

            // Middleware para múltiplos uploads
            array: (fieldName: string, maxCount: number = 10) => [
                upload.array(fieldName, maxCount),
                this.processUploadedImages(finalConfig)
            ],

            // Middleware para múltiplos campos
            fields: (fields: { name: string; maxCount?: number }[]) => [
                upload.fields(fields),
                this.processUploadedImages(finalConfig)
            ]
        };
    }

    /**
     * Middleware que processa as imagens após upload
     */
    private static processUploadedImages(config: UploadConfig) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                // Garantir que o diretório de upload existe
                await fs.mkdir(config.uploadDir!, { recursive: true });

                let files: Express.Multer.File[] = [];

                // Normalizar files para array
                if (req.file) {
                    files = [req.file];
                } else if (req.files) {
                    if (Array.isArray(req.files)) {
                        files = req.files;
                    } else {
                        // req.files é um objeto com arrays de arquivos
                        files = Object.values(req.files).flat();
                    }
                }

                if (files.length === 0) {
                    return next();
                }

                // Processar cada arquivo
                const processedFiles: ProcessedFile[] = [];

                for (const file of files) {
                    const processed = await this.processImage(file, config);
                    processedFiles.push(processed);
                    
                    // Remover arquivo temporário
                    try {
                        await fs.unlink(file.path);
                    } catch (error) {
                        console.warn(`Erro ao remover arquivo temporário ${file.path}:`, error);
                    }
                }

                // Adicionar arquivos processados ao request
                (req as Request & { processedFiles: ProcessedFile[] }).processedFiles = processedFiles;

                next();
            } catch (error) {
                console.error('Erro no processamento de imagens:', error);
                next(error);
            }
        };
    }

    /**
     * Processa uma única imagem
     */
    private static async processImage(
        file: Express.Multer.File,
        config: UploadConfig
    ): Promise<ProcessedFile> {
        const timestamp = Date.now();
        const baseName = path.parse(file.originalname).name;
        const safeName = this.sanitizeFilename(baseName);
        
        // Nomes dos arquivos finais
        const compressedFileName = `${safeName}-${timestamp}.webp`;
        const compressedPath = path.join(config.uploadDir!, compressedFileName);

        // Comprimir imagem principal
        const compressionResult = await ImageCompressionService.compressImage(
            file.path,
            compressedPath,
            config.compression
        );

        if (!compressionResult.success) {
            throw new Error(`Erro na compressão: ${compressionResult.error}`);
        }

        const processedFile: ProcessedFile = {
            original: {
                filename: file.originalname,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            },
            compressed: {
                filename: compressedFileName,
                path: compressedPath,
                size: compressionResult.compressedSize,
                compressionRatio: compressionResult.compressionRatio,
                dimensions: compressionResult.dimensions
            }
        };

        // Criar variantes se solicitado
        if (config.variants) {
            const variantsDir = path.join(config.uploadDir!, 'variants');
            await fs.mkdir(variantsDir, { recursive: true });

            const variants = await ImageCompressionService.createImageVariants(
                file.path,
                variantsDir,
                `${safeName}-${timestamp}`
            );

            processedFile.variants = {};
            for (const [variant, result] of Object.entries(variants)) {
                if (result.success) {
                    processedFile.variants[variant] = {
                        filename: path.basename(result.outputPath),
                        path: result.outputPath,
                        size: result.compressedSize,
                        dimensions: result.dimensions
                    };
                }
            }
        }

        return processedFile;
    }

    /**
     * Sanitiza nome de arquivo removendo caracteres especiais
     */
    private static sanitizeFilename(filename: string): string {
        return filename
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Middleware para validação adicional de imagens
     */
    static validateImages() {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const processedFiles = (req as Request & { processedFiles?: ProcessedFile[] }).processedFiles;
                
                if (!processedFiles || processedFiles.length === 0) {
                    return next();
                }

                // Validar cada imagem processada
                for (const processedFile of processedFiles) {
                    const isValid = await ImageCompressionService.validateImage(processedFile.compressed.path);
                    
                    if (!isValid) {
                        // Remover arquivo inválido
                        try {
                            await fs.unlink(processedFile.compressed.path);
                        } catch (error) {
                            console.warn('Erro ao remover arquivo inválido:', error);
                        }
                        
                        return res.status(400).json({
                            error: `Arquivo inválido: ${processedFile.original.filename}`
                        });
                    }

                    // Verificar se está dentro do limite de tamanho
                    const maxSize = 1 * 1024 * 1024; // 1MB
                    if (processedFile.compressed.size > maxSize) {
                        return res.status(400).json({
                            error: `Arquivo muito grande após compressão: ${processedFile.original.filename}`
                        });
                    }
                }

                next();
            } catch (error) {
                console.error('Erro na validação de imagens:', error);
                next(error);
            }
        };
    }

    /**
     * Middleware para limpeza de arquivos temporários em caso de erro
     */
    static cleanup() {
        return (error: Error, req: Request, res: Response, next: NextFunction) => {
            // Limpar arquivos temporários se houve erro
            const cleanup = async () => {
                if (req.file) {
                    try {
                        await fs.unlink(req.file.path);
                    } catch (cleanupError) {
                        console.warn('Erro na limpeza de arquivo temporário:', cleanupError);
                    }
                }

                if (req.files) {
                    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
                    
                    for (const file of files) {
                        try {
                            await fs.unlink(file.path);
                        } catch (cleanupError) {
                            console.warn('Erro na limpeza de arquivo temporário:', cleanupError);
                        }
                    }
                }
            };

            cleanup().finally(() => next(error));
        };
    }
}

// Extensão de tipos para Request
export interface RequestWithFiles extends Request {
    processedFiles?: ProcessedFile[];
}
