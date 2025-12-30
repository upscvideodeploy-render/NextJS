'use client';

import { useState, useEffect } from 'react';

export default function FlashcardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const res = await fetch('/api/flashcards/review');
    const data = await res.json();
    setCards(data.flashcards || []);
    setLoading(false);
  };

  const reviewCard = async (rating: 'easy' | 'medium' | 'hard') => {
    await fetch('/api/flashcards/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cards[currentIndex].id, rating })
    });

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    } else {
      fetchCards();
      setCurrentIndex(0);
      setFlipped(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (cards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-4">Flashcards</h1>
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <p className="text-gray-600">No flashcards due for review today. Great job!</p>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Flashcards</h1>
        <div className="text-sm text-gray-600">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div
        onClick={() => setFlipped(!flipped)}
        className="bg-white rounded-lg shadow-lg p-12 min-h-[300px] flex items-center justify-center cursor-pointer hover:shadow-xl transition-shadow"
      >
        <div className="text-center">
          {!flipped ? (
            <div>
              <div className="text-sm text-gray-500 mb-4">Question</div>
              <p className="text-2xl font-medium">{card.question}</p>
            </div>
          ) : (
            <div>
              <div className="text-sm text-gray-500 mb-4">Answer</div>
              <p className="text-xl">{card.answer}</p>
            </div>
          )}
        </div>
      </div>

      {flipped && (
        <div className="flex justify-center space-x-4 mt-8">
          <button
            onClick={() => reviewCard('hard')}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Hard
          </button>
          <button
            onClick={() => reviewCard('medium')}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Medium
          </button>
          <button
            onClick={() => reviewCard('easy')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Easy
          </button>
        </div>
      )}

      {!flipped && (
        <div className="text-center mt-8 text-gray-500">
          Click card to reveal answer
        </div>
      )}
    </div>
  );
}
