import { Request, Response } from 'express';
import { Campaign } from '../models/node';

// Interface para rolagem de dados
interface DiceRollRequest {
    formula: string; // ex: "1d20+5", "3d6+2", "2d8-1"
    context?: string; // contexto da rolagem
    isPrivate?: boolean; // se apenas GM pode ver
    advantage?: boolean; // para D&D 5e
    disadvantage?: boolean; // para D&D 5e
    campaignId?: string; // para salvar no histórico
}

// Interface para resultado de rolagem
interface DiceRollResult {
    formula: string;
    result: number;
    individual: number[];
    modifier: number;
    advantage: boolean;
    disadvantage: boolean;
    context?: string;
    rollerId: string;
    timestamp: Date;
    isPrivate: boolean;
}

export class DiceController {
    // Função para rolar dados
    static rollDice(sides: number): number {
        return Math.floor(Math.random() * sides) + 1;
    }

    // Função para parsear fórmula de dados
    static parseFormula(formula: string): { dice: number; sides: number; modifier: number } {
        // Remove espaços e converte para minúsculas
        const cleanFormula = formula.replace(/\s/g, '').toLowerCase();
        
        // Regex para capturar XdY+Z ou XdY-Z
        const match = cleanFormula.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
        
        if (!match) {
            throw new Error('Fórmula de dados inválida');
        }
        
        const dice = parseInt(match[1] || '1', 10);
        const sides = parseInt(match[2], 10);
        const modifier = match[3] ? parseInt(match[3], 10) : 0;
        
        // Validações
        if (dice < 1 || dice > 100) {
            throw new Error('Número de dados deve estar entre 1 e 100');
        }
        
        if (sides < 2 || sides > 1000) {
            throw new Error('Número de lados deve estar entre 2 e 1000');
        }
        
        return { dice, sides, modifier };
    }

    // Rolar dados individuais
    static rollMultipleDice(dice: number, sides: number): number[] {
        const results: number[] = [];
        for (let i = 0; i < dice; i++) {
            results.push(this.rollDice(sides));
        }
        return results;
    }

    // Calcular resultado com advantage/disadvantage
    static calculateAdvantageResult(rolls: number[], advantage: boolean, disadvantage: boolean): number {
        if (advantage && !disadvantage) {
            return Math.max(...rolls);
        } else if (disadvantage && !advantage) {
            return Math.min(...rolls);
        }
        return rolls[0]; // Normal roll
    }

    // Endpoint principal para rolagem de dados
    static async rollDiceEndpoint(req: Request, res: Response) {
        try {
            const {
                formula,
                context = '',
                isPrivate = false,
                advantage = false,
                disadvantage = false,
                campaignId
            }: DiceRollRequest = req.body;

            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            if (!formula) {
                return res.status(400).json({ error: 'Fórmula de dados é obrigatória' });
            }

            // Parse da fórmula
            const { dice, sides, modifier } = this.parseFormula(formula);

            // Rolar dados
            let individual: number[];
            
            if ((advantage || disadvantage) && dice === 1) {
                // Para advantage/disadvantage, rolar 2 dados
                individual = this.rollMultipleDice(2, sides);
            } else {
                individual = this.rollMultipleDice(dice, sides);
            }

            // Calcular resultado
            let diceSum: number;
            if ((advantage || disadvantage) && dice === 1) {
                diceSum = this.calculateAdvantageResult(individual, advantage, disadvantage);
            } else {
                diceSum = individual.reduce((sum, roll) => sum + roll, 0);
            }

            const result = diceSum + modifier;

            // Criar objeto de resultado
            const rollResult: DiceRollResult = {
                formula,
                result,
                individual,
                modifier,
                advantage,
                disadvantage,
                context,
                rollerId: userId,
                timestamp: new Date(),
                isPrivate
            };

            // Se há campanha especificada, salvar no histórico
            if (campaignId) {
                try {
                    const campaign = await Campaign.findById(campaignId);
                    if (campaign) {
                        // Verificar se o usuário tem acesso à campanha
                        const hasAccess = campaign.gmId.toString() === userId || 
                                        campaign.players.includes(userId as never);

                        if (hasAccess) {
                            // Adicionar ao chat global da campanha
                            const chatMessage = {
                                content: `**${context || 'Rolagem'}**: ${formula} = ${result}`,
                                type: 'dice',
                                senderId: userId,
                                diceRoll: rollResult,
                                timestamp: new Date(),
                                isVisible: !isPrivate || campaign.gmId.toString() === userId,
                                metadata: new Map()
                            };

                            campaign.globalChat.push(chatMessage as never);
                            await campaign.save();
                        }
                    }
                } catch (error) {
                    console.error('Erro ao salvar rolagem no histórico:', error);
                    // Não retornar erro aqui, apenas logar
                }
            }

            res.json(rollResult);
        } catch (error) {
            console.error('Erro ao rolar dados:', error);
            if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Erro interno do servidor' });
            }
        }
    }

    // Endpoint para rolar múltiplas fórmulas de uma vez
    static async rollMultipleEndpoint(req: Request, res: Response) {
        try {
            const { rolls }: { rolls: DiceRollRequest[] } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            if (!Array.isArray(rolls) || rolls.length === 0) {
                return res.status(400).json({ error: 'Array de rolagens é obrigatório' });
            }

            if (rolls.length > 10) {
                return res.status(400).json({ error: 'Máximo de 10 rolagens por vez' });
            }

            const results: DiceRollResult[] = [];

            for (const rollRequest of rolls) {
                try {
                    const { formula, context = '', isPrivate = false, advantage = false, disadvantage = false } = rollRequest;
                    
                    const { dice, sides, modifier } = this.parseFormula(formula);
                    
                    let individual: number[];
                    if ((advantage || disadvantage) && dice === 1) {
                        individual = this.rollMultipleDice(2, sides);
                    } else {
                        individual = this.rollMultipleDice(dice, sides);
                    }

                    let diceSum: number;
                    if ((advantage || disadvantage) && dice === 1) {
                        diceSum = this.calculateAdvantageResult(individual, advantage, disadvantage);
                    } else {
                        diceSum = individual.reduce((sum, roll) => sum + roll, 0);
                    }

                    const result = diceSum + modifier;

                    results.push({
                        formula,
                        result,
                        individual,
                        modifier,
                        advantage,
                        disadvantage,
                        context,
                        rollerId: userId,
                        timestamp: new Date(),
                        isPrivate
                    });
                } catch (error) {
                    // Se uma rolagem falhar, adicionar erro ao resultado
                    results.push({
                        formula: rollRequest.formula,
                        result: 0,
                        individual: [],
                        modifier: 0,
                        advantage: false,
                        disadvantage: false,
                        context: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                        rollerId: userId,
                        timestamp: new Date(),
                        isPrivate: false
                    });
                }
            }

            res.json({ results });
        } catch (error) {
            console.error('Erro ao rolar múltiplos dados:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Endpoint para estatísticas de dados
    static async getDiceStats(req: Request, res: Response) {
        try {
            const { formula, iterations = 1000 } = req.query;

            if (!formula || typeof formula !== 'string') {
                return res.status(400).json({ error: 'Fórmula é obrigatória' });
            }

            const iterationsNum = Math.min(parseInt(iterations as string, 10) || 1000, 10000);

            const { dice, sides, modifier } = this.parseFormula(formula);
            const results: number[] = [];

            // Simular rolagens
            for (let i = 0; i < iterationsNum; i++) {
                const individual = this.rollMultipleDice(dice, sides);
                const sum = individual.reduce((total, roll) => total + roll, 0);
                results.push(sum + modifier);
            }

            // Calcular estatísticas
            const min = Math.min(...results);
            const max = Math.max(...results);
            const average = results.reduce((sum, result) => sum + result, 0) / results.length;
            
            // Calcular distribuição
            const distribution: Record<number, number> = {};
            results.forEach(result => {
                distribution[result] = (distribution[result] || 0) + 1;
            });

            // Converter para porcentagens
            const distributionPercent: Record<number, number> = {};
            Object.keys(distribution).forEach(key => {
                const numKey = parseInt(key, 10);
                distributionPercent[numKey] = (distribution[numKey] / iterationsNum) * 100;
            });

            res.json({
                formula,
                iterations: iterationsNum,
                stats: {
                    min,
                    max,
                    average: Math.round(average * 100) / 100,
                    theoretical: {
                        min: dice + modifier,
                        max: dice * sides + modifier,
                        average: ((dice * (sides + 1)) / 2) + modifier
                    }
                },
                distribution: distributionPercent
            });
        } catch (error) {
            console.error('Erro ao calcular estatísticas:', error);
            if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Erro interno do servidor' });
            }
        }
    }
}
