import { Router } from 'express';
import { CampaignController } from '../controllers/campaignController';
import { CharacterController } from '../controllers/characterController';
import { DiceController } from '../controllers/diceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Aplicar autenticação a todas as rotas
router.use(authenticateToken);

// Rotas de campanhas
router.post('/campaigns', CampaignController.createCampaign);
router.get('/campaigns', CampaignController.getUserCampaigns);
router.get('/campaigns/:campaignId', CampaignController.getCampaign);
router.post('/campaigns/:campaignId/players', CampaignController.addPlayer);
router.delete('/campaigns/:campaignId/players/:playerId', CampaignController.removePlayer);
router.put('/campaigns/:campaignId/settings', CampaignController.updateSettings);
router.post('/campaigns/:campaignId/sessions', CampaignController.startSession);

// Rotas de personagens
router.post('/characters', CharacterController.createCharacter);
router.get('/characters', CharacterController.listCharacters);
router.get('/characters/:id', CharacterController.getCharacter);
router.put('/characters/:id', CharacterController.updateCharacter);
router.delete('/characters/:id', CharacterController.deleteCharacter);
router.post('/characters/:id/duplicate', CharacterController.duplicateCharacter);
router.patch('/characters/:id/toggle-public', CharacterController.togglePublic);

// Rotas específicas de sistema
router.get('/characters/:id/validate', CharacterController.validateCharacter);
router.get('/campaigns/:campaignId/characters', CharacterController.getCampaignCharacters);
router.get('/systems/supported', CharacterController.getSupportedSystems);

// Rotas específicas por campanha
router.get('/campaigns/:campaignId/characters', CharacterController.getCampaignCharacters);

// Rotas de dados
router.post('/dice/roll', DiceController.rollDiceEndpoint);
router.post('/dice/roll-multiple', DiceController.rollMultipleEndpoint);
router.get('/dice/stats', DiceController.getDiceStats);

export default router;
