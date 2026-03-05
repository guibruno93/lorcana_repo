import React, { useState } from "react";

interface DeckFormProps {
  onSubmit: (deck: any[]) => void;
}

const DeckForm: React.FC<DeckFormProps> = ({ onSubmit }) => {
  const [deckJSON, setDeckJSON] = useState<string>(
    `[{"name":"Aurora, a Guardiã da Luz","type":"Character","cost":3,"rarity":"Epic","faction":"Fairy Tale","abilities":["Flying","Draw 1 card"],"count":2}]`
  );
  const [error, setError] = useState<string>("");

  const handleSubmit = () => {
    try {
      const deck = JSON.parse(deckJSON);
      if (!Array.isArray(deck)) throw new Error("Deck deve ser um array");
      onSubmit(deck);
      setError("");
    } catch (err: any) {
      setError("JSON inválido: " + err.message);
    }
  };

  return (
    <div>
      <h2>Insira seu deck (JSON)</h2>
      <textarea
        value={deckJSON}
        onChange={(e) => setDeckJSON(e.target.value)}
        rows={10}
        cols={60}
        style={{ fontFamily: "monospace", width: "100%" }}
      />
      <br />
      <button onClick={handleSubmit}>Analisar Deck</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default DeckForm;
