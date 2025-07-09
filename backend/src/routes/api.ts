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
router.get('/characters', CharacterController.getUserCharacters);
router.get('/characters/:characterId', CharacterController.getCharacter);
router.put('/characters/:characterId', CharacterController.updateCharacter);
router.delete('/characters/:characterId', CharacterController.deleteCharacter);
router.post('/characters/:characterId/inventory', CharacterController.addInventoryItem);
router.post('/characters/:characterId/abilities', CharacterController.addAbility);

// Rotas específicas de sistema
router.get('/characters/:characterId/validate', CharacterController.validateCharacter);
router.post('/characters/:characterId/migrate-system', CharacterController.migrateCharacterSystem);
router.get('/systems/supported', CharacterController.getSupportedSystems);

// Rotas específicas por campanha
router.get('/campaigns/:campaignId/characters', CharacterController.getCampaignCharacters);

// Rotas de dados
router.post('/dice/roll', DiceController.rollDiceEndpoint);
router.post('/dice/roll-multiple', DiceController.rollMultipleEndpoint);
router.get('/dice/stats', DiceController.getDiceStats);

export default router;
