import ollama from "ollama";
import dotenv from "dotenv";

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

const test = async () => {
  try {
    console.log("🧪 Testing Ollama Embeddings...");
    console.log(`📍 Ollama URL: ${OLLAMA_BASE_URL}`);
    console.log(`🤖 Model: nomic-embed-text`);
    console.log("");

    // Use ollama directly (it handles the connection internally)
    const emb = await ollama.embeddings({
      model: "nomic-embed-text",
      prompt: "hello world",
      options: {
        host: OLLAMA_BASE_URL
      }
    });

    console.log("✅ Embedding generated successfully!");
    console.log("");
    console.log("📊 Embedding Details:");
    console.log(`   - Dimensions: ${emb.embedding.length}`);
    console.log(`   - First 5 values: [${emb.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log(`   - Last 5 values: [...${emb.embedding.slice(-5).map(v => v.toFixed(4)).join(', ')}]`);
    console.log("");

    // Verify dimension match
    if (emb.embedding.length === 768) {
      console.log("✅ Perfect! Embedding dimension (768) matches database vector(768) type!");
    } else {
      console.log(`⚠️  Warning: Embedding dimension (${emb.embedding.length}) doesn't match expected 768`);
      console.log(`   Update schema to vector(${emb.embedding.length}) if needed`);
    }

    console.log("");
    console.log("🎉 Test completed successfully!");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("");
    console.error("💡 Troubleshooting:");
    console.error("   1. Make sure Ollama is running: ollama serve");
    console.error("   2. Pull the model: ollama pull nomic-embed-text");
    console.error("   3. Check OLLAMA_BASE_URL in .env file");
    process.exit(1);
  }
};

test();

