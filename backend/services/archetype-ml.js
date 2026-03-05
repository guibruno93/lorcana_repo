/**
 * SISTEMA DE MACHINE LEARNING - IDENTIFICAÇÃO DE ARQUÉTIPOS
 * 
 * Usa TensorFlow.js para classificar decks em arquétipos
 * Treina com dados históricos do banco de dados
 * 
 * Arquivo: backend/services/archetype-ml.js
 */

const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════════════
// PARTE 1: FEATURE EXTRACTION (Extração de características)
// ═══════════════════════════════════════════════════════════════════

class ArchetypeFeatureExtractor {
  constructor() {
    // Cards-chave para cada slot de curva
    this.keyCards = new Map();
    this.cardToIndex = new Map();
    this.indexToCard = new Map();
    this.archetypeToIndex = new Map();
    this.indexToArchetype = new Map();
  }
  
  /**
   * Treinar o vocabulário de cartas baseado em decks do banco
   */
  async buildVocabulary() {
    console.log('🔍 Building card vocabulary...');
    
    // Buscar todos os decks com arquétipo conhecido
    const { data: decks, error } = await supabase
      .from('decks')
      .select('cards, archetype')
      .eq('format', 'core')  // Filtrar apenas Core
      .not('archetype', 'is', null)
      .neq('archetype', 'Unknown')
      .limit(1000);
    
    if (error) throw error;
    
    // Contar frequência de cada carta
    const cardFrequency = new Map();
    const archetypeSet = new Set();
    
    for (const deck of decks) {
      if (!Array.isArray(deck.cards)) continue;
      
      archetypeSet.add(deck.archetype);
      
      for (const card of deck.cards) {
        const name = card.name || card.card_name;
        if (!name) continue;
        
        cardFrequency.set(name, (cardFrequency.get(name) || 0) + 1);
      }
    }
    
    // Pegar top 200 cartas mais comuns
    const sortedCards = Array.from(cardFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([name]) => name);
    
    // Criar mapeamentos
    sortedCards.forEach((card, idx) => {
      this.cardToIndex.set(card, idx);
      this.indexToCard.set(idx, card);
    });
    
    // Criar mapeamento de arquétipos
    const archetypes = Array.from(archetypeSet).sort();
    archetypes.forEach((arch, idx) => {
      this.archetypeToIndex.set(arch, idx);
      this.indexToArchetype.set(idx, arch);
    });
    
    console.log(`✅ Vocabulary: ${sortedCards.length} cards, ${archetypes.length} archetypes`);
    
    return {
      cardCount: sortedCards.length,
      archetypeCount: archetypes.length
    };
  }
  
  /**
   * Extrair features de um deck
   * Retorna vetor de features para o ML
   */
  extractFeatures(deck) {
    const features = [];
    
    // 1. CARD PRESENCE (200 features - one-hot)
    const cardVector = new Array(this.cardToIndex.size).fill(0);
    
    for (const card of deck.cards || []) {
      const name = card.name || card.card_name;
      if (!name) continue;
      
      const idx = this.cardToIndex.get(name);
      if (idx !== undefined) {
        cardVector[idx] = card.quantity || 1; // Quantidade da carta
      }
    }
    
    features.push(...cardVector);
    
    // 2. MANA CURVE (10 features - distribuição por custo)
    const manaCurve = new Array(10).fill(0);
    let totalCards = 0;
    
    for (const card of deck.cards || []) {
      const cost = Math.min(9, card.cost || 0);
      const qty = card.quantity || 1;
      manaCurve[cost] += qty;
      totalCards += qty;
    }
    
    // Normalizar por total de cartas
    const normalizedCurve = manaCurve.map(count => 
      totalCards > 0 ? count / totalCards : 0
    );
    
    features.push(...normalizedCurve);
    
    // 3. INKS (6 features - distribuição de cores)
    const inkVector = new Array(6).fill(0);
    const inkMap = {
      'Amber': 0,
      'Amethyst': 1,
      'Emerald': 2,
      'Ruby': 3,
      'Sapphire': 4,
      'Steel': 5
    };
    
    if (Array.isArray(deck.inks)) {
      for (const ink of deck.inks) {
        const idx = inkMap[ink];
        if (idx !== undefined) {
          inkVector[idx] = 1;
        }
      }
    }
    
    features.push(...inkVector);
    
    // 4. DECK STATS (5 features)
    const avgCost = totalCards > 0
      ? deck.cards.reduce((sum, c) => sum + (c.cost || 0) * (c.quantity || 1), 0) / totalCards
      : 0;
    
    const maxCost = Math.max(0, ...deck.cards.map(c => c.cost || 0));
    const minCost = Math.min(10, ...deck.cards.map(c => c.cost || 0).filter(c => c > 0));
    const uniqueCards = deck.cards.length;
    const totalCopies = totalCards;
    
    features.push(avgCost, maxCost, minCost, uniqueCards, totalCopies);
    
    return features;
  }
  
  /**
   * Converte arquétipo para one-hot encoding
   */
  archetypeToOneHot(archetype) {
    const vector = new Array(this.archetypeToIndex.size).fill(0);
    const idx = this.archetypeToIndex.get(archetype);
    
    if (idx !== undefined) {
      vector[idx] = 1;
    }
    
    return vector;
  }
  
  /**
   * Converte one-hot para nome do arquétipo
   */
  oneHotToArchetype(oneHot) {
    const maxIdx = oneHot.indexOf(Math.max(...oneHot));
    return this.indexToArchetype.get(maxIdx) || 'Unknown';
  }
}

// ═══════════════════════════════════════════════════════════════════
// PARTE 2: MODELO ML (Neural Network)
// ═══════════════════════════════════════════════════════════════════

class ArchetypeClassifier {
  constructor(featureExtractor) {
    this.extractor = featureExtractor;
    this.model = null;
  }
  
  /**
   * Criar modelo neural network
   */
  createModel(inputSize, outputSize) {
    const model = tf.sequential();
    
    // Input layer + hidden layers
    model.add(tf.layers.dense({
      inputShape: [inputSize],
      units: 128,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    model.add(tf.layers.dropout({ rate: 0.3 }));
    
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    // Output layer (softmax para classificação multi-classe)
    model.add(tf.layers.dense({
      units: outputSize,
      activation: 'softmax'
    }));
    
    // Compilar modelo
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    this.model = model;
    
    console.log('✅ Model created:');
    model.summary();
    
    return model;
  }
  
  /**
   * Treinar modelo com dados do banco
   */
  async train(epochs = 50, batchSize = 32) {
    console.log('🎓 Starting training...');
    
    // 1. Buscar decks do banco
    const { data: decks, error } = await supabase
      .from('decks')
      .select('cards, archetype, inks')
      .eq('format', 'core')  // Filtrar apenas Core
      .not('archetype', 'is', null)
      .neq('archetype', 'Unknown')
      .limit(5000);
    
    if (error) throw error;
    
    if (decks.length < 50) {
      throw new Error('Not enough training data. Need at least 50 decks.');
    }
    
    console.log(`📊 Training with ${decks.length} decks`);
    
    // 2. Extrair features
    const X = [];
    const y = [];
    
    for (const deck of decks) {
      try {
        const features = this.extractor.extractFeatures(deck);
        const label = this.extractor.archetypeToOneHot(deck.archetype);
        
        X.push(features);
        y.push(label);
      } catch (err) {
        console.warn(`⚠️  Error processing deck: ${err.message}`);
      }
    }
    
    if (X.length === 0) {
      throw new Error('No valid training data extracted');
    }
    
    // 3. Converter para tensors
    const xTensor = tf.tensor2d(X);
    const yTensor = tf.tensor2d(y);
    
    // 4. Split train/validation (80/20)
    const splitIdx = Math.floor(X.length * 0.8);
    
    const xTrain = xTensor.slice([0, 0], [splitIdx, -1]);
    const yTrain = yTensor.slice([0, 0], [splitIdx, -1]);
    
    const xVal = xTensor.slice([splitIdx, 0], [-1, -1]);
    const yVal = yTensor.slice([splitIdx, 0], [-1, -1]);
    
    // 5. Criar modelo se não existir
    if (!this.model) {
      this.createModel(X[0].length, y[0].length);
    }
    
    // 6. Treinar
    const history = await this.model.fit(xTrain, yTrain, {
      epochs,
      batchSize,
      validationData: [xVal, yVal],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(
            `Epoch ${epoch + 1}/${epochs} - ` +
            `loss: ${logs.loss.toFixed(4)} - ` +
            `acc: ${(logs.acc * 100).toFixed(2)}% - ` +
            `val_loss: ${logs.val_loss.toFixed(4)} - ` +
            `val_acc: ${(logs.val_acc * 100).toFixed(2)}%`
          );
        }
      }
    });
    
    // 7. Limpar tensors
    xTensor.dispose();
    yTensor.dispose();
    xTrain.dispose();
    yTrain.dispose();
    xVal.dispose();
    yVal.dispose();
    
    const finalAcc = history.history.val_acc[history.history.val_acc.length - 1];
    console.log(`\n✅ Training completed! Final validation accuracy: ${(finalAcc * 100).toFixed(2)}%`);
    
    return {
      accuracy: finalAcc,
      epochs,
      trainingSamples: splitIdx,
      validationSamples: X.length - splitIdx
    };
  }
  
  /**
   * Prever arquétipo de um deck
   */
  predict(deck) {
    if (!this.model) {
      throw new Error('Model not trained. Call train() first.');
    }
    
    // Extrair features
    const features = this.extractor.extractFeatures(deck);
    
    // Fazer predição
    const tensor = tf.tensor2d([features]);
    const prediction = this.model.predict(tensor);
    const probabilities = prediction.dataSync();
    
    // Limpar
    tensor.dispose();
    prediction.dispose();
    
    // Pegar top 3 predições
    const results = Array.from(probabilities)
      .map((prob, idx) => ({
        archetype: this.extractor.indexToArchetype.get(idx),
        confidence: prob
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    return {
      archetype: results[0].archetype,
      confidence: results[0].confidence,
      alternatives: results.slice(1)
    };
  }
  
  /**
   * Salvar modelo treinado
   */
  async saveModel(path = './models/archetype-classifier') {
    if (!this.model) {
      throw new Error('No model to save');
    }
    
    // Browser version não suporta file://
    // Usar node-fs handler customizado
    const fs = require('fs');
    const pathModule = require('path');
    
    // Criar diretório se não existir
    const dir = pathModule.dirname(path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Salvar usando downloads (funciona no Node)
    const handler = tf.io.getSaveHandlers('downloads://archetype-model')[0];
    
    if (!handler) {
      // Fallback: salvar manualmente usando model artifacts
      console.log('⚠️  Using manual save (no file handler available)');
      const saveResult = await this.model.save(tf.io.withSaveHandler(async (artifacts) => {
        // Salvar model.json
        fs.writeFileSync(
          pathModule.join(path, 'model.json'),
          JSON.stringify(artifacts.modelTopology)
        );
        
        // Salvar weights
        const weightsManifest = [{
          paths: ['weights.bin'],
          weights: artifacts.weightSpecs
        }];
        
        fs.writeFileSync(
          pathModule.join(path, 'weights.bin'),
          Buffer.from(artifacts.weightData)
        );
        
        return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
      }));
      
      console.log(`✅ Model saved manually to ${path}`);
      return saveResult;
    }
    
    await this.model.save(handler);
    console.log(`✅ Model saved to ${path}`);
  }
  
  /**
   * Carregar modelo treinado
   */
  async loadModel(path = './models/archetype-classifier') {
    const fs = require('fs');
    const pathModule = require('path');
    
    const modelPath = pathModule.join(path, 'model.json');
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model not found at ${modelPath}`);
    }
    
    // Carregar manualmente
    const modelJSON = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
    const weightsPath = pathModule.join(path, 'weights.bin');
    const weightsData = fs.readFileSync(weightsPath);
    
    this.model = await tf.loadLayersModel(tf.io.fromMemory(
      modelJSON,
      weightsData
    ));
    
    console.log(`✅ Model loaded from ${path}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PARTE 3: SISTEMA HÍBRIDO (ML + Regras)
// ═══════════════════════════════════════════════════════════════════

class HybridArchetypeIdentifier {
  constructor() {
    this.extractor = new ArchetypeFeatureExtractor();
    this.classifier = null;
    this.ruleBasedIdentifier = null; // Importar do sistema antigo
  }
  
  /**
   * Inicializar sistema
   */
  async initialize() {
    console.log('🚀 Initializing Hybrid Archetype Identifier...');
    
    // 1. Build vocabulary
    await this.extractor.buildVocabulary();
    
    // 2. Criar classificador
    this.classifier = new ArchetypeClassifier(this.extractor);
    
    // 3. Tentar carregar modelo existente
    try {
      await this.classifier.loadModel();
      console.log('✅ Loaded pre-trained model');
    } catch (err) {
      console.log('⚠️  No pre-trained model found. Will need to train.');
    }
  }
  
  /**
   * Treinar novo modelo
   */
  async train(epochs = 50) {
    if (!this.classifier) {
      await this.initialize();
    }
    
    const results = await this.classifier.train(epochs);
    
    // Salvar modelo
    await this.classifier.saveModel();
    
    // Salvar vocabulary
    const fs = require('fs');
    const vocabData = {
      cardToIndex: Array.from(this.extractor.cardToIndex.entries()),
      archetypeToIndex: Array.from(this.extractor.archetypeToIndex.entries())
    };
    
    fs.writeFileSync(
      './models/vocabulary.json',
      JSON.stringify(vocabData, null, 2)
    );
    
    console.log('✅ Vocabulary saved');
    
    return results;
  }
  
  /**
   * Identificar arquétipo (híbrido: ML + regras)
   */
  async identify(deck) {
    // 1. Usar ML se disponível
    let mlResult = null;
    
    if (this.classifier && this.classifier.model) {
      try {
        mlResult = this.classifier.predict(deck);
      } catch (err) {
        console.warn('⚠️  ML prediction failed:', err.message);
      }
    }
    
    // 2. Usar regras como fallback ou complemento
    const ruleResult = this.identifyByRules(deck);
    
    // 3. Combinar resultados
    if (mlResult && mlResult.confidence > 0.7) {
      // Alta confiança no ML
      return {
        archetype: mlResult.archetype,
        confidence: mlResult.confidence,
        method: 'ml',
        alternatives: mlResult.alternatives
      };
    } else if (mlResult && ruleResult && mlResult.archetype === ruleResult.archetype) {
      // ML e regras concordam
      return {
        archetype: mlResult.archetype,
        confidence: (mlResult.confidence + ruleResult.confidence) / 2,
        method: 'hybrid',
        mlConfidence: mlResult.confidence,
        ruleConfidence: ruleResult.confidence
      };
    } else if (ruleResult && ruleResult.confidence > 0.5) {
      // Usar regras
      return {
        ...ruleResult,
        method: 'rules'
      };
    } else if (mlResult) {
      // ML com baixa confiança, mas melhor que nada
      return {
        ...mlResult,
        method: 'ml_lowconf'
      };
    } else {
      // Fallback
      return {
        archetype: 'Unknown',
        confidence: 0,
        method: 'unknown'
      };
    }
  }
  
  /**
   * Identificação baseada em regras (sistema antigo)
   */
  identifyByRules(deck) {
    // Importar lógica do matchups-mulligan-system.js
    // (por enquanto, placeholder)
    
    const signatures = {
      'evasive': ['Cheshire Cat', 'Genie', 'Elsa'],
      'aggro': ['Mowgli', 'Strength of a Raging Fire'],
      'control': ['Basil', 'Under the Sea']
    };
    
    let bestMatch = 'Unknown';
    let bestScore = 0;
    
    for (const [archetype, keywords] of Object.entries(signatures)) {
      let score = 0;
      for (const keyword of keywords) {
        for (const card of deck.cards || []) {
          if ((card.name || '').includes(keyword)) {
            score++;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = archetype;
      }
    }
    
    return {
      archetype: bestMatch,
      confidence: Math.min(1, bestScore / 3)
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  ArchetypeFeatureExtractor,
  ArchetypeClassifier,
  HybridArchetypeIdentifier
};

// ═══════════════════════════════════════════════════════════════════
// EXEMPLO DE USO
// ═══════════════════════════════════════════════════════════════════

/*
// TREINAR MODELO (executar uma vez)
const { HybridArchetypeIdentifier } = require('./archetype-ml');

const identifier = new HybridArchetypeIdentifier();
await identifier.initialize();
await identifier.train(50); // 50 epochs

// USO EM PRODUÇÃO
const identifier = new HybridArchetypeIdentifier();
await identifier.initialize();

const deck = {
  cards: [
    { name: 'Cheshire Cat - Inexplicable', cost: 3, quantity: 4 },
    { name: 'Genie - Wish Fulfilled', cost: 5, quantity: 3 }
  ],
  inks: ['Amethyst', 'Sapphire']
};

const result = await identifier.identify(deck);
console.log(result);
// {
//   archetype: 'evasive',
//   confidence: 0.92,
//   method: 'ml',
//   alternatives: [
//     { archetype: 'midrange', confidence: 0.05 },
//     { archetype: 'control', confidence: 0.03 }
//   ]
// }
*/
