/**
 * SCRIPT: Treinar modelo ML de identificação de arquétipos
 * 
 * Executar: node scripts/train-archetype-ml.js
 * 
 * Pré-requisitos:
 * - Ter decks no banco com arquétipo preenchido
 * - npm install @tensorflow/tfjs-node
 */

require('dotenv').config();
const { HybridArchetypeIdentifier } = require('../services/archetype-ml');

async function main() {
  console.log('🤖 ARCHETYPE ML TRAINER\n');
  
  try {
    // 1. Inicializar sistema
    const identifier = new HybridArchetypeIdentifier();
    await identifier.initialize();
    
    // 2. Treinar modelo
    console.log('\n🎓 Starting training...');
    const results = await identifier.train(50); // 50 epochs
    
    // 3. Mostrar resultados
    console.log('\n📊 Training Results:');
    console.log(`   Accuracy: ${(results.accuracy * 100).toFixed(2)}%`);
    console.log(`   Epochs: ${results.epochs}`);
    console.log(`   Training samples: ${results.trainingSamples}`);
    console.log(`   Validation samples: ${results.validationSamples}`);
    
    // 4. Testar com deck de exemplo
    console.log('\n🧪 Testing with sample deck...');
    
    const testDeck = {
      cards: [
        { name: 'Cheshire Cat - Inexplicable', cost: 3, quantity: 4 },
        { name: 'Genie - Wish Fulfilled', cost: 5, quantity: 3 },
        { name: 'Elsa - The Fifth Spirit', cost: 8, quantity: 2 }
      ],
      inks: ['Amethyst', 'Sapphire']
    };
    
    const prediction = await identifier.identify(testDeck);
    
    console.log('\n   Prediction:');
    console.log(`   Archetype: ${prediction.archetype}`);
    console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(2)}%`);
    console.log(`   Method: ${prediction.method}`);
    
    if (prediction.alternatives) {
      console.log('\n   Alternatives:');
      for (const alt of prediction.alternatives) {
        console.log(`   - ${alt.archetype}: ${(alt.confidence * 100).toFixed(2)}%`);
      }
    }
    
    console.log('\n✅ Training completed successfully!');
    console.log('   Model saved to: ./models/archetype-classifier');
    console.log('   Vocabulary saved to: ./models/vocabulary.json');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
