import { useState } from "react";
import "./App.css";

function App() {
  const [text, setText] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !problemDescription.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          description: problemDescription,
        }),
      });
      const result = await response.json();
      console.log(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app">
      <form onSubmit={handleSubmit} className="form-container">
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          placeholder="Paste the problem description from LeetCode here..."
          className="text-input"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your solution with explanation and code here..."
          className="text-input"
        />
        <button
          type="submit"
          className="submit-btn"
          disabled={isSubmitting || !text.trim()}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}

export default App;
