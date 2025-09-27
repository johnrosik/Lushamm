# Lushamm RPG Backend

Bem-vindo ao **Lushamm**, uma plataforma completa para mestres e jogadores de RPG administrarem campanhas, fichas de personagem, mapas e rolagens de dados em um único lugar. Este repositório contém o backend escrito em **Node.js** com **TypeScript**, seguindo boas práticas de organização, validação e escalabilidade.

## Principais recursos

- **Gerenciamento de campanhas** com controle de jogadores, permissões e progressão.
- **Fichas de personagem dinâmicas** compatíveis com múltiplos sistemas (`D&D 5e`, `FATE`, `Cyberpunk`, `Call of Cthulhu`, `Pathfinder`, `Vampire` e sistemas customizados).
- **Sistema de validação por sistema** através do `SystemManager`, garantindo coerência de atributos e cálculos derivados.
- **Controle granular de permissões** (dono, GM, jogadores convidados) para visualização, edição e exclusão de personagens.
- **Upload e compressão de imagens** com múltiplos formatos suportados (`jpeg`, `png`, `webp`) e geração otimizada via `Sharp`.
- **Integração com WebSocket** para chat em tempo real, rolagens de dados e sincronização de mapas.
- **Infraestrutura preparada para produção** (scripts Docker, deploy Oracle Cloud, validação com ESLint, build TypeScript dedicado).

## Estrutura do projeto

```
backend/
 ├─ src/
 │   ├─ controllers/      # Lógica de negócios (auth, campaign, character, dice, image, websocket)
 │   ├─ models/           # Schemas Mongoose unificados em `models/node.ts`
 │   ├─ routes/           # Rotas Express com tipagem e middleware dedicado
 │   ├─ services/         # Serviços de domínio (SystemManager, compressão de imagens, etc.)
 │   ├─ middleware/       # Middlewares de autenticação, autorização e utilidades
 │   └─ types/            # Tipos auxiliares e contratos compartilhados
 ├─ deploy/               # Dockerfile, docker-compose e scripts de provisionamento (Oracle Cloud)
 ├─ util/                 # Scripts de suporte (ex.: validação de variáveis de ambiente)
 ├─ scripts/              # Automatizações (seed, ferramentas administrativas)
 ├─ app.ts / server.ts    # Bootstrap da aplicação HTTP/WebSocket
 └─ tsconfig.json         # Configuração TypeScript compartilhada
```

## Stack tecnológica

| Camada             | Tecnologia                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| Linguagem          | Node.js + TypeScript                                                        |
| Framework web      | Express                                                                     |
| Banco de dados     | MongoDB (via Mongoose)                                                      |
| Autenticação       | JWT + bcrypt                                                                |
| Tempo real         | Socket.IO                                                                   |
| Upload e imagens   | Multer + Sharp                                                              |
| Qualidade de código| ESLint, TypeScript estrito, scripts de build                                |
| Deploy             | Docker, docker-compose, scripts Oracle Cloud                                |

## Como rodar o projeto

1. **Instale dependências**

```bash
cd backend
npm install
```

2. **Configure as variáveis de ambiente**

```bash
cp .env.example .env
# Edite .env com a URL do MongoDB, JWT_SECRET, etc.
```

3. **Execute em modo desenvolvimento**

```bash
npm run dev
```

4. **Build de produção**

```bash
npm run build
```

5. **Lint opcional**

```bash
npm run lint
```

## Endpoints em destaque

- `POST /api/auth/login` – Autenticação JWT.
- `GET /api/campaigns` – Listagem e gerenciamento de campanhas.
- `POST /api/characters` – Criação de personagens com validações específicas de sistema.
- `PATCH /api/characters/:id/toggle-public` – Alternância de visibilidade para compartilhamento público.
- `POST /api/images/upload/single` – Upload e compressão automática de imagens.
- `GET /api/systems/supported` – Lista de sistemas de RPG atualmente suportados.

## Boas práticas implementadas

- **Validação rigorosa** de ObjectId e payloads em todos os controladores.
- **Tratamento consistente de erros** com mapeamento para status HTTP adequados.
- **Reuso de lógica** via `SystemManager` para cálculos, templates e migração entre sistemas.
- **Permissões refinadas** (`isOwner`, `isGM`, `hasEditPermission`) para acesso seguro aos recursos.
- **Tipagem sem `any`** em rotas sensíveis (e.g. upload de imagens) e remoção de código morto.
- **Scripts utilitários** para facilitar compressão de imagens, geração de mocks e deploy automatizado.


## Próximos passos

- Criar suíte de testes automatizados (unitários e integração).
- Implementar cache distribuído para consultas frequentes (Redis).
- Expandir cobertura WebSocket para eventos de mapa/token.
- Disponibilizar documentação pública (Swagger/OpenAPI).
- Adicionar pipelines CI/CD para lint, build e deploy automatizados.

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch (`git checkout -b feat/minha-melhoria`)
3. Commit suas alterações (`git commit -m 'feat: minha melhoria'`)
4. Faça push (`git push origin feat/minha-melhoria`)
5. Abra um Pull Request

## Licença

Este projeto está disponível sob os termos da licença **MIT**. Consulte o arquivo `LICENSE` (quando disponível) para mais informações.

---

💬 **Precisa de ajuda ou quer sugerir melhorias?** Abra uma issue ou entre em contato. O Lushamm continua evoluindo para oferecer a melhor experiência de RPG online!
