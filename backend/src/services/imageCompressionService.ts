/**
 * Serviço de compressão e processamento de imagens
 * Utiliza Sharp para reduzir o tamanho das imagens mantendo qualidade
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export interface ImageCompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxFileSizeMB?: number;
    format?: 'jpeg' | 'png' | 'webp';
    progressive?: boolean;
}

export interface CompressionResult {
    success: boolean;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    outputPath: string;
    format: string;
    dimensions: {
        width: number;
        height: number;
    };
    error?: string;
}

export class ImageCompressionService {
    private static readonly DEFAULT_OPTIONS: ImageCompressionOptions = {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 80,
        maxFileSizeMB: 1,
        format: 'jpeg',
        progressive: true
    };

    /**
     * Comprime uma imagem para ficar dentro do limite de tamanho especificado
     */
    static async compressImage(
        inputPath: string,
        outputPath: string,
        options: Partial<ImageCompressionOptions> = {}
    ): Promise<CompressionResult> {
        const config = { ...this.DEFAULT_OPTIONS, ...options };
        const maxFileSizeBytes = config.maxFileSizeMB! * 1024 * 1024;

        try {
            // Verificar se o arquivo de entrada existe
            const inputStats = await fs.stat(inputPath);
            const originalSize = inputStats.size;

            // Se já está dentro do limite e não precisa redimensionar
            if (originalSize <= maxFileSizeBytes && !this.needsResizing(inputPath, config)) {
                await fs.copyFile(inputPath, outputPath);
                const metadata = await sharp(inputPath).metadata();
                
                return {
                    success: true,
                    originalSize,
                    compressedSize: originalSize,
                    compressionRatio: 1,
                    outputPath,
                    format: metadata.format || 'unknown',
                    dimensions: {
                        width: metadata.width || 0,
                        height: metadata.height || 0
                    }
                };
            }

            // Processar a imagem
            let quality = config.quality!;
            let attempt = 0;
            const maxAttempts = 10;

            while (attempt < maxAttempts) {
                await this.processImage(inputPath, outputPath, {
                    ...config,
                    quality
                });

                // Verificar o tamanho do arquivo resultante
                const outputStats = await fs.stat(outputPath);
                const compressedSize = outputStats.size;

                if (compressedSize <= maxFileSizeBytes) {
                    const metadata = await sharp(outputPath).metadata();
                    
                    return {
                        success: true,
                        originalSize,
                        compressedSize,
                        compressionRatio: originalSize / compressedSize,
                        outputPath,
                        format: config.format!,
                        dimensions: {
                            width: metadata.width || 0,
                            height: metadata.height || 0
                        }
                    };
                }

                // Reduzir qualidade para próxima tentativa
                quality = Math.max(20, quality - 10);
                attempt++;
            }

            // Se não conseguiu comprimir suficientemente, tentar reduzir dimensões
            return await this.compressWithReducedDimensions(
                inputPath, 
                outputPath, 
                config, 
                maxFileSizeBytes, 
                originalSize
            );

        } catch (error) {
            return {
                success: false,
                originalSize: 0,
                compressedSize: 0,
                compressionRatio: 0,
                outputPath,
                format: 'unknown',
                dimensions: { width: 0, height: 0 },
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            };
        }
    }

    /**
     * Processa a imagem com as configurações especificadas
     */
    private static async processImage(
        inputPath: string,
        outputPath: string,
        options: ImageCompressionOptions
    ): Promise<void> {
        const image = sharp(inputPath);
        
        // Redimensionar se necessário
        if (options.maxWidth || options.maxHeight) {
            image.resize(options.maxWidth, options.maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // Aplicar formato e compressão
        switch (options.format) {
            case 'jpeg':
                image.jpeg({
                    quality: options.quality,
                    progressive: options.progressive,
                    mozjpeg: true // Usar encoder mozjpeg para melhor compressão
                });
                break;
            
            case 'png':
                image.png({
                    quality: options.quality,
                    compressionLevel: 9,
                    progressive: options.progressive
                });
                break;
            
            case 'webp':
                image.webp({
                    quality: options.quality,
                    effort: 6 // Máximo esforço de compressão
                });
                break;
        }

        await image.toFile(outputPath);
    }

    /**
     * Comprime reduzindo as dimensões progressivamente
     */
    private static async compressWithReducedDimensions(
        inputPath: string,
        outputPath: string,
        options: ImageCompressionOptions,
        maxFileSizeBytes: number,
        originalSize: number
    ): Promise<CompressionResult> {
        const metadata = await sharp(inputPath).metadata();
        const currentWidth = metadata.width || 1920;
        const currentHeight = metadata.height || 1080;
        
        const reductionFactors = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
        
        for (const factor of reductionFactors) {
            const newWidth = Math.floor(currentWidth * factor);
            const newHeight = Math.floor(currentHeight * factor);
            
            await this.processImage(inputPath, outputPath, {
                ...options,
                maxWidth: newWidth,
                maxHeight: newHeight,
                quality: 75 // Qualidade média para dimensões reduzidas
            });
            
            const outputStats = await fs.stat(outputPath);
            const compressedSize = outputStats.size;
            
            if (compressedSize <= maxFileSizeBytes) {
                const finalMetadata = await sharp(outputPath).metadata();
                
                return {
                    success: true,
                    originalSize,
                    compressedSize,
                    compressionRatio: originalSize / compressedSize,
                    outputPath,
                    format: options.format!,
                    dimensions: {
                        width: finalMetadata.width || 0,
                        height: finalMetadata.height || 0
                    }
                };
            }
        }

        // Se ainda assim não conseguiu
        return {
            success: false,
            originalSize,
            compressedSize: 0,
            compressionRatio: 0,
            outputPath,
            format: options.format || 'unknown',
            dimensions: { width: 0, height: 0 },
            error: `Não foi possível comprimir a imagem para menos de ${options.maxFileSizeMB}MB`
        };
    }

    /**
     * Verifica se a imagem precisa ser redimensionada
     */
    private static async needsResizing(
        inputPath: string,
        options: ImageCompressionOptions
    ): Promise<boolean> {
        try {
            const metadata = await sharp(inputPath).metadata();
            const width = metadata.width || 0;
            const height = metadata.height || 0;
            
            return !!(options.maxWidth && width > options.maxWidth) ||
                   !!(options.maxHeight && height > options.maxHeight);
        } catch {
            return false;
        }
    }

    /**
     * Obtém informações sobre uma imagem
     */
    static async getImageInfo(filePath: string) {
        try {
            const metadata = await sharp(filePath).metadata();
            const stats = await fs.stat(filePath);
            
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: stats.size,
                sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
                hasAlpha: metadata.hasAlpha,
                density: metadata.density,
                colorspace: metadata.space
            };
        } catch (error) {
            throw new Error(`Erro ao obter informações da imagem: ${error}`);
        }
    }

    /**
     * Converte imagem para WebP (formato mais eficiente)
     */
    static async convertToWebP(
        inputPath: string,
        outputPath: string,
        quality: number = 80
    ): Promise<CompressionResult> {
        return this.compressImage(inputPath, outputPath, {
            format: 'webp',
            quality,
            maxFileSizeMB: 1
        });
    }

    /**
     * Cria múltiplas versões de uma imagem (thumbnails, médio, original)
     */
    static async createImageVariants(
        inputPath: string,
        outputDir: string,
        baseName: string
    ) {
        const variants = {
            thumbnail: { maxWidth: 150, maxHeight: 150, quality: 70 },
            small: { maxWidth: 400, maxHeight: 400, quality: 75 },
            medium: { maxWidth: 800, maxHeight: 600, quality: 80 },
            large: { maxWidth: 1920, maxHeight: 1080, quality: 85 }
        };

        const results: Record<string, CompressionResult> = {};

        for (const [variant, options] of Object.entries(variants)) {
            const outputPath = path.join(outputDir, `${baseName}_${variant}.webp`);
            
            results[variant] = await this.compressImage(inputPath, outputPath, {
                ...options,
                format: 'webp',
                maxFileSizeMB: variant === 'large' ? 1 : 0.5
            });
        }

        return results;
    }

    /**
     * Valida se um arquivo é uma imagem válida
     */
    static async validateImage(filePath: string): Promise<boolean> {
        try {
            const metadata = await sharp(filePath).metadata();
            return !!(metadata.width && metadata.height && metadata.format);
        } catch {
            return false;
        }
    }
}
