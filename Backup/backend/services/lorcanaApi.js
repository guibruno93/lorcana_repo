let cachedCards = null;

async function getAllCards() {
  if (cachedCards) {
    return cachedCards;
  }

  console.log("🌐 Buscando cartas da API...");

  const response = await fetch(
    "https://raw.githubusercontent.com/LorcanaJSON/lorcana-json/main/cards/en/cards.json"
  );

  if (!response.ok) {
    throw new Error("Erro ao buscar cartas da API");
  }

  const data = await response.json();

  cachedCards = data.map(card => ({
    name: card.name,
    ink: card.ink,
    type: card.type,
    cost: Number(card.cost)
  }));

  console.log("✅ Cartas carregadas:", cachedCards.length);
  return cachedCards;
}

module.exports = {
  getAllCards
};
