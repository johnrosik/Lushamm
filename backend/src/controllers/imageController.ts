/**
 * Controlador para upload e gerenciamento de imagens
 * Demonstra como usar o sistema de compressão de imagens
 */

import { Request, Response } from 'express';
import { ImageCompressionService } from '../services/imageCompressionService';
import { RequestWithFiles } from '../middleware/imageUpload';
import path from 'path';
import fs from 'fs/promises';

export class ImageController {
    /**
     * Upload de uma única imagem
     */
    static async uploadSingle(req: RequestWithFiles, res: Response) {
        try {
            if (!req.processedFiles || req.processedFiles.length === 0) {
                return res.status(400).json({
                    error: 'Nenhuma imagem foi enviada'
                });
            }

            const processedFile = req.processedFiles[0];

            res.json({
                success: true,
                message: 'Imagem enviada e processada com sucesso',
                file: {
                    originalName: processedFile.original.filename,
                    originalSize: `${(processedFile.original.size / 1024 / 1024).toFixed(2)} MB`,
                    compressedName: processedFile.compressed.filename,
                    compressedSize: `${(processedFile.compressed.size / 1024 / 1024).toFixed(2)} MB`,
                    compressionRatio: `${(processedFile.compressed.compressionRatio).toFixed(2)}x`,
                    dimensions: processedFile.compressed.dimensions,
                    url: `/uploads/images/${processedFile.compressed.filename}`,
                    variants: processedFile.variants ? Object.keys(processedFile.variants) : []
                }
            });
        } catch (error) {
            console.error('Erro no upload de imagem:', error);
            res.status(500).json({
                error: 'Erro interno do servidor no upload de imagem'
            });
        }
    }

    /**
     * Upload de múltiplas imagens
     */
    static async uploadMultiple(req: RequestWithFiles, res: Response) {
        try {
            if (!req.processedFiles || req.processedFiles.length === 0) {
                return res.status(400).json({
                    error: 'Nenhuma imagem foi enviada'
                });
            }

            const results = req.processedFiles.map(processedFile => ({
                originalName: processedFile.original.filename,
                originalSize: `${(processedFile.original.size / 1024 / 1024).toFixed(2)} MB`,
                compressedName: processedFile.compressed.filename,
                compressedSize: `${(processedFile.compressed.size / 1024 / 1024).toFixed(2)} MB`,
                compressionRatio: `${(processedFile.compressed.compressionRatio).toFixed(2)}x`,
                dimensions: processedFile.compressed.dimensions,
                url: `/uploads/images/${processedFile.compressed.filename}`,
                variants: processedFile.variants ? Object.keys(processedFile.variants) : []
            }));

            res.json({
                success: true,
                message: `${req.processedFiles.length} imagens processadas com sucesso`,
                files: results,
                totalOriginalSize: `${(req.processedFiles.reduce((sum, f) => sum + f.original.size, 0) / 1024 / 1024).toFixed(2)} MB`,
                totalCompressedSize: `${(req.processedFiles.reduce((sum, f) => sum + f.compressed.size, 0) / 1024 / 1024).toFixed(2)} MB`
            });
        } catch (error) {
            console.error('Erro no upload múltiplo:', error);
            res.status(500).json({
                error: 'Erro interno do servidor no upload múltiplo'
            });
        }
    }

    /**
     * Upload de avatar de usuário
     */
    static async uploadAvatar(req: RequestWithFiles, res: Response) {
        try {
            if (!req.processedFiles || req.processedFiles.length === 0) {
                return res.status(400).json({
                    error: 'Nenhuma imagem de avatar foi enviada'
                });
            }

            const processedFile = req.processedFiles[0];
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Usuário não autenticado'
                });
            }

            // Aqui você salvaria a URL do avatar no banco de dados do usuário
            // const user = await User.findByIdAndUpdate(userId, {
            //     avatar: `/uploads/images/${processedFile.compressed.filename}`
            // });

            res.json({
                success: true,
                message: 'Avatar atualizado com sucesso',
                avatar: {
                    url: `/uploads/images/${processedFile.compressed.filename}`,
                    size: `${(processedFile.compressed.size / 1024).toFixed(0)} KB`,
                    dimensions: processedFile.compressed.dimensions
                }
            });
        } catch (error) {
            console.error('Erro no upload de avatar:', error);
            res.status(500).json({
                error: 'Erro interno do servidor no upload de avatar'
            });
        }
    }

    /**
     * Upload de imagem para campanha/mapa
     */
    static async uploadCampaignImage(req: RequestWithFiles, res: Response) {
        try {
            const { campaignId } = req.params;
            const { type } = req.body; // 'map', 'token', 'background', etc.

            if (!req.processedFiles || req.processedFiles.length === 0) {
                return res.status(400).json({
                    error: 'Nenhuma imagem foi enviada'
                });
            }

            const processedFile = req.processedFiles[0];

            // Aqui você validaria se o usuário tem permissão para a campanha
            // e salvaria a referência da imagem no banco

            res.json({
                success: true,
                message: `Imagem de ${type} enviada com sucesso`,
                campaignId,
                imageType: type,
                image: {
                    filename: processedFile.compressed.filename,
                    url: `/uploads/images/${processedFile.compressed.filename}`,
                    size: `${(processedFile.compressed.size / 1024).toFixed(0)} KB`,
                    dimensions: processedFile.compressed.dimensions,
                    variants: processedFile.variants
                }
            });
        } catch (error) {
            console.error('Erro no upload de imagem da campanha:', error);
            res.status(500).json({
                error: 'Erro interno do servidor no upload de imagem da campanha'
            });
        }
    }

    /**
     * Obter informações sobre uma imagem
     */
    static async getImageInfo(req: Request, res: Response) {
        try {
            const { filename } = req.params;
            const imagePath = path.join('./uploads/images', filename);

            // Verificar se arquivo existe
            try {
                await fs.access(imagePath);
            } catch {
                return res.status(404).json({
                    error: 'Imagem não encontrada'
                });
            }

            const info = await ImageCompressionService.getImageInfo(imagePath);

            res.json({
                success: true,
                filename,
                info
            });
        } catch (error) {
            console.error('Erro ao obter informações da imagem:', error);
            res.status(500).json({
                error: 'Erro interno do servidor ao obter informações da imagem'
            });
        }
    }

    /**
     * Deletar uma imagem
     */
    static async deleteImage(req: Request, res: Response) {
        try {
            const { filename } = req.params;
            const imagePath = path.join('./uploads/images', filename);

            // Verificar se arquivo existe
            try {
                await fs.access(imagePath);
            } catch {
                return res.status(404).json({
                    error: 'Imagem não encontrada'
                });
            }

            // Deletar arquivo
            await fs.unlink(imagePath);

            // Aqui você também removeria referências do banco de dados

            res.json({
                success: true,
                message: 'Imagem deletada com sucesso',
                filename
            });
        } catch (error) {
            console.error('Erro ao deletar imagem:', error);
            res.status(500).json({
                error: 'Erro interno do servidor ao deletar imagem'
            });
        }
    }

    /**
     * Listar imagens (com paginação)
     */
    static async listImages(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const skip = (page - 1) * limit;

            const uploadsDir = './uploads/images';
            
            // Verificar se diretório existe
            try {
                await fs.access(uploadsDir);
            } catch {
                return res.json({
                    success: true,
                    images: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0
                    }
                });
            }

            // Listar arquivos
            const files = await fs.readdir(uploadsDir);
            const imageFiles = files.filter(file => 
                /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
            );

            const total = imageFiles.length;
            const totalPages = Math.ceil(total / limit);
            const paginatedFiles = imageFiles.slice(skip, skip + limit);

            // Obter informações de cada arquivo
            const images = await Promise.all(
                paginatedFiles.map(async (filename) => {
                    try {
                        const filePath = path.join(uploadsDir, filename);
                        const info = await ImageCompressionService.getImageInfo(filePath);
                        return {
                            filename,
                            url: `/uploads/images/${filename}`,
                            ...info
                        };
                    } catch {
                        return {
                            filename,
                            url: `/uploads/images/${filename}`,
                            error: 'Erro ao obter informações'
                        };
                    }
                })
            );

            res.json({
                success: true,
                images,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            });
        } catch (error) {
            console.error('Erro ao listar imagens:', error);
            res.status(500).json({
                error: 'Erro interno do servidor ao listar imagens'
            });
        }
    }

    /**
     * Comprimir uma imagem existente
     */
    static async compressExisting(req: Request, res: Response) {
        try {
            const { filename } = req.params;
            const { quality, maxWidth, maxHeight, format } = req.body;

            const inputPath = path.join('./uploads/images', filename);
            const outputFilename = `compressed-${Date.now()}-${filename}`;
            const outputPath = path.join('./uploads/images', outputFilename);

            // Verificar se arquivo existe
            try {
                await fs.access(inputPath);
            } catch {
                return res.status(404).json({
                    error: 'Imagem não encontrada'
                });
            }

            const result = await ImageCompressionService.compressImage(inputPath, outputPath, {
                quality: quality || 80,
                maxWidth: maxWidth || 1920,
                maxHeight: maxHeight || 1080,
                format: format || 'webp',
                maxFileSizeMB: 1
            });

            if (!result.success) {
                return res.status(400).json({
                    error: `Erro na compressão: ${result.error}`
                });
            }

            res.json({
                success: true,
                message: 'Imagem comprimida com sucesso',
                original: {
                    filename,
                    size: `${(result.originalSize / 1024 / 1024).toFixed(2)} MB`
                },
                compressed: {
                    filename: outputFilename,
                    url: `/uploads/images/${outputFilename}`,
                    size: `${(result.compressedSize / 1024 / 1024).toFixed(2)} MB`,
                    compressionRatio: `${result.compressionRatio.toFixed(2)}x`,
                    dimensions: result.dimensions
                }
            });
        } catch (error) {
            console.error('Erro ao comprimir imagem existente:', error);
            res.status(500).json({
                error: 'Erro interno do servidor ao comprimir imagem'
            });
        }
    }
}
