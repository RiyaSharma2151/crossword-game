"use client";
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import styles from "@/CrosswordGame.module.css";

// ---------- TYPES ----------
type Direction = "ACROSS" | "DOWN";

interface CellPosition {
  row: number;
  col: number;
}

interface WordData {
  id: number;
  word: string;
  clue: string;
  start: CellPosition;
  direction: Direction;
}

interface CrosswordGridCell {
  letter: string | null;       // Solution letter
  displayLetter: string;       // User-input letter
  clueNumber: number | null;   // Starting clue number
  wordIds: number[];           // IDs of words passing through this cell
}

interface BankWord {
  word: string;
  clue: string;
}

// ---------- CONFIG ----------
const GRID_ROWS = 8;
const GRID_COLS = 8;
const MAX_WORDS_IN_PUZZLE = 8;
const Max_clue = 3;

// ---------- WORD BANK (LOCAL, FREE) ----------
const WORD_BANK: BankWord[] = [
  { word: "CAMPAIGN", clue: "A coordinated marketing effort." },
  { word: "BRAND", clue: "Identity that distinguishes a product or company." },
  { word: "TARGET", clue: "Intended audience for a marketing message." },
  { word: "NICHE", clue: "A specialized segment of the market." },
  { word: "ROI", clue: "Return on investment, a key marketing measure." },
  { word: "KPI", clue: "A measurable marketing performance indicator." },
  { word: "CTA", clue: "Call to action, for short." },
  { word: "PPC", clue: "Paid advertising model, for short." },
  { word: "AD", clue: "Short for advertisement." },
  { word: "LEAD", clue: "A potential customer who has shown interest." },
  { word: "FUNNEL", clue: "Path a customer takes from awareness to purchase." },
  { word: "SOCIAL", clue: "Type of media platform for online engagement." },
  { word: "CONTENT", clue: "Information created for marketing value." },
  { word: "EMAIL", clue: "Common channel used for newsletters and campaigns." },
];

// ---------- HELPER: SHUFFLE ----------
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------- GENERATOR: CHECK IF WORD CAN BE PLACED ----------
function canPlaceWord(
  grid: (string | null)[][],
  word: string,
  startRow: number,
  startCol: number,
  direction: Direction
): boolean {
  let row = startRow;
  let col = startCol;

  for (let i = 0; i < word.length; i++) {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
      return false;
    }

    const cellLetter = grid[row][col];
    const char = word[i];

    if (cellLetter !== null && cellLetter !== char) {
      return false; // conflict
    }

    if (direction === "ACROSS") col++;
    else row++;
  }

  return true;
}

// ---------- GENERATOR: PLACE WORD ON GRID ----------
function placeWordOnGrid(
  grid: (string | null)[][],
  word: string,
  startRow: number,
  startCol: number,
  direction: Direction
) {
  let row = startRow;
  let col = startCol;

  for (let i = 0; i < word.length; i++) {
    grid[row][col] = word[i];
    if (direction === "ACROSS") col++;
    else row++;
  }
}

// ---------- GENERATOR: CREATE RANDOM CROSSWORD ----------
function generateCrosswordFromBank(): WordData[] {
  const chosenBank = shuffleArray(WORD_BANK)
    .slice(0, MAX_WORDS_IN_PUZZLE)
    .sort((a, b) => b.word.length - a.word.length); // longest first

  const letterGrid: (string | null)[][] = Array.from(
    { length: GRID_ROWS },
    () => Array.from({ length: GRID_COLS }, () => null as string | null)
  );

  const placedWords: WordData[] = [];
  let nextId = 1;

  // 1) place first word horizontally in the middle
  if (chosenBank.length === 0) return [];
  const first = chosenBank[0];
  const firstWord = first.word.toUpperCase();
  const firstRow = Math.floor(GRID_ROWS / 2);
  const firstCol = Math.max(0, Math.floor((GRID_COLS - firstWord.length) / 2));

  placeWordOnGrid(letterGrid, firstWord, firstRow, firstCol, "ACROSS");
  placedWords.push({
    id: nextId++,
    word: firstWord,
    clue: first.clue,
    start: { row: firstRow, col: firstCol },
    direction: "ACROSS",
  });

  // 2) place remaining words by trying to intersect
  for (let bIndex = 1; bIndex < chosenBank.length; bIndex++) {
    const entry = chosenBank[bIndex];
    const word = entry.word.toUpperCase();
    let placed = false;

    for (let i = 0; i < word.length && !placed; i++) {
      const char = word[i];

      for (const existing of placedWords) {
        const existingWord = existing.word;

        for (let j = 0; j < existingWord.length && !placed; j++) {
          if (existingWord[j] !== char) continue;

          let startRow: number;
          let startCol: number;
          let direction: Direction;

          if (existing.direction === "ACROSS") {
            // existing across, new down
            direction = "DOWN";
            startRow = existing.start.row - i;
            startCol = existing.start.col + j;
          } else {
            // existing down, new across
            direction = "ACROSS";
            startRow = existing.start.row + j;
            startCol = existing.start.col - i;
          }

          if (canPlaceWord(letterGrid, word, startRow, startCol, direction)) {
            placeWordOnGrid(letterGrid, word, startRow, startCol, direction);
            placedWords.push({
              id: nextId++,
              word,
              clue: entry.clue,
              start: { row: startRow, col: startCol },
              direction,
            });
            placed = true;
          }
        }
      }
    }

    // 3) if we still couldn't place it, try non-intersecting horizontal placement
    if (!placed) {
      outer: for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c <= GRID_COLS - word.length; c++) {
          if (canPlaceWord(letterGrid, word, r, c, "ACROSS")) {
            placeWordOnGrid(letterGrid, word, r, c, "ACROSS");
            placedWords.push({
              id: nextId++,
              word,
              clue: entry.clue,
              start: { row: r, col: c },
              direction: "ACROSS",
            });
            placed = true;
            break outer;
          }
        }
      }
    }
    // If can't be placed at all, skip the word.
  }

  return placedWords;
}

// ---------- GRID INITIALISER ----------
const initializeGrid = (
  words: WordData[],
  size: { rows: number; cols: number }
): CrosswordGridCell[][] => {
  const grid: CrosswordGridCell[][] = Array.from(
    { length: size.rows },
    () =>
      Array.from({ length: size.cols }, () => ({
        letter: null,
        displayLetter: "",
        clueNumber: null,
        wordIds: [],
      }))
  );

  words.forEach((wordData) => {
    let { row, col } = wordData.start;

    for (let i = 0; i < wordData.word.length; i++) {
      const cell = grid[row]?.[col];
      if (!cell) break;

      const char = wordData.word[i];

      if (i === 0 && cell.clueNumber === null) {
        cell.clueNumber = wordData.id;
      }

      if (cell.letter === null) {
        cell.letter = char;
      } else if (cell.letter !== char) {
        console.error(
          `Conflict placing word ${wordData.word} at (${row},${col})`
        );
      }

      if (!cell.wordIds.includes(wordData.id)) {
        cell.wordIds.push(wordData.id);
      }

      if (wordData.direction === "ACROSS") col++;
      else row++;
    }
  });

  return grid;
};

// ---------- HELPER: FORMAT TIME ----------
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" + s : s}`;
};

// ---------- MAIN COMPONENT ----------
export const CrosswordGame: React.FC = () => {
  const [words, setWords] = useState<WordData[]>([]);
  const [grid, setGrid] = useState<CrosswordGridCell[][]>([]);
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [activeWordId, setActiveWordId] = useState<number | null>(null);
  const [solvedWords, setSolvedWords] = useState<Set<number>>(new Set());

  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes

  const gridSize = { rows: GRID_ROWS, cols: GRID_COLS };

  const startNewGame = () => {
    const generated = generateCrosswordFromBank();
    setWords(generated);
    setGrid(initializeGrid(generated, gridSize));
    setSolvedWords(new Set());
    setActiveCell(null);
    setActiveWordId(null);
    setTimeLeft(120);
    setGameStarted(true);
  };

  // timer logic
  useEffect(() => {
    if (!gameStarted) return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, timeLeft]);

  const totalUniqueWords = useMemo(
    () => new Set(words.map((w) => w.id)).size,
    [words]
  );

  const isPuzzleSolved =
    totalUniqueWords > 0 && solvedWords.size === totalUniqueWords;

  const currentWordData = useMemo(
    () =>
      activeWordId !== null
        ? words.find((w) => w.id === activeWordId) || null
        : null,
    [activeWordId, words]
  );

  const clues = useMemo(() => {
    const across: WordData[] = [];
    const down: WordData[] = [];
    words.forEach((word) => {
      if (word.direction === "ACROSS") across.push(word);
      if (word.direction === "DOWN") down.push(word);
    });
    const uniqueAcross = Array.from(
      new Map(across.map((w) => [w.id, w])).values()
    ).sort((a, b) => a.id - b.id);
    const uniqueDown = Array.from(
      new Map(down.map((w) => [w.id, w])).values()
    ).sort((a, b) => a.id - b.id);
    return { across: uniqueAcross, down: uniqueDown };
  }, [words]);

  // --- Check a word whenever a letter changes ---
  const checkWord = useCallback(
    (wordData: WordData, currentGrid: CrosswordGridCell[][]) => {
      let { row, col } = wordData.start;
      let userAnswer = "";

      for (let i = 0; i < wordData.word.length; i++) {
        const cell = currentGrid[row]?.[col];
        userAnswer += cell?.displayLetter || "";
        if (wordData.direction === "ACROSS") col++;
        else row++;
      }

      const isCorrect =
        userAnswer.toUpperCase() === wordData.word.toUpperCase();

      setSolvedWords((prev) => {
        const newSet = new Set(prev);
        if (isCorrect) newSet.add(wordData.id);
        else newSet.delete(wordData.id);
        return newSet;
      });
    },
    []
  );

  // --- Handle typing in a cell ---
  const handleCellChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const newValue = e.target.value.toUpperCase().slice(-1);

    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((c) => ({ ...c })));
      const cell = newGrid[rowIndex][colIndex];
      cell.displayLetter = newValue;

      // Check all words this cell belongs to
      cell.wordIds.forEach((wordId) => {
        const wordData = words.find((w) => w.id === wordId);
        if (wordData) checkWord(wordData, newGrid);
      });

      // Auto-advance within current word
      if (newValue && activeWordId !== null) {
        const currentWord = words.find((w) => w.id === activeWordId);
        if (currentWord) {
          let nextRow = rowIndex;
          let nextCol = colIndex;
          if (currentWord.direction === "ACROSS") nextCol++;
          else nextRow++;

          const nextCell = newGrid[nextRow]?.[nextCol];
          if (nextCell && nextCell.wordIds.includes(activeWordId)) {
            setActiveCell({ row: nextRow, col: nextCol });
          }
        }
      }

      return newGrid;
    });
  };

  // --- Handle clicking a cell on the grid ---
  const handleCellClick = (
    rowIndex: number,
    colIndex: number,
    cell: CrosswordGridCell
  ) => {
    if (!cell.letter) return;

    setActiveCell({ row: rowIndex, col: colIndex });

    // If multiple words intersect here, toggle through them
    if (cell.wordIds.length > 1) {
      const current = activeWordId;
      if (current === null) {
        setActiveWordId(cell.wordIds[0]);
      } else {
        const idx = cell.wordIds.indexOf(current);
        const nextIndex =
          idx === -1 ? 0 : (idx + 1) % cell.wordIds.length;
        setActiveWordId(cell.wordIds[nextIndex]);
      }
    } else if (cell.wordIds.length === 1) {
      setActiveWordId(cell.wordIds[0]);
    }
  };

  // --- Auto-focus active cell input ---
  useEffect(() => {
    if (!activeCell) return;

    const id = `cell-${activeCell.row}-${activeCell.col}`;
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.focus();
      el.select();
    }
  }, [activeCell, activeWordId]);

  // ---------- UI STATES ----------

  // Start screen: game not started
  if (!gameStarted) {
    return (
      <div className={styles.crosswordContainer}>
        <h1 className={styles.dailyTitle}>THE DAILY PUZZLE</h1>

        <div className={styles.metaLine}>
          <span>DECEMBER 02, 2025</span>
          <span>AWARD: A FREE WEBSITE FEEDBACK</span>
        </div>

        <div className={styles.timerLine}>
          <span className={styles.timerText}>TIME LEFT: 02:00</span>
        </div>

        <div className={styles.startScreen}>
          <button
            className={styles.startButton}
            onClick={startNewGame}
          >
            START PUZZLE
          </button>
        </div>
      </div>
    );
  }

  // Time up screen
  if (timeLeft <= 0) {
    return (
      <div className={styles.crosswordContainer}>
        <h1 className={styles.dailyTitle}>THE DAILY PUZZLE</h1>

        <div className={styles.metaLine}>
          <span>DECEMBER 02, 2025</span>
          <span>AWARD: A FREE WEBSITE FEEDBACK</span>
        </div>

        <div className={styles.timerLine}>
          <span className={styles.timerText}>TIME LEFT: 0:00</span>
        </div>

        <div className={styles.completionMessage}>
          <h2>Time&apos;s Up! ⏰</h2>
          <p>Want to try a fresh puzzle?</p>
          <button
            className={styles.claimButton}
            onClick={startNewGame}
          >
            New Puzzle
          </button>
        </div>
      </div>
    );
  }

  // Safety: if for some reason grid is not ready
  if (!grid.length || !words.length) {
    return (
      <div className={styles.crosswordContainer}>
        <h1 className={styles.dailyTitle}>THE DAILY PUZZLE</h1>

        <div className={styles.metaLine}>
          <span>DECEMBER 02, 2025</span>
          <span>AWARD: A FREE WEBSITE FEEDBACK</span>
        </div>

        <div className={styles.timerLine}>
          <span className={styles.timerText}>
            TIME LEFT: {formatTime(timeLeft)}
          </span>
        </div>

        <p style={{ padding: "1rem" }}>Preparing your puzzle...</p>
      </div>
    );
  }

  const activeClueText = currentWordData
    ? `${currentWordData.id} ${currentWordData.direction} – ${currentWordData.clue}`
    : "Select a word on the grid.";

  return (
    <div className={styles.crosswordContainer}>
      <h1 className={styles.dailyTitle}>THE DAILY PUZZLE</h1>

      <div className={styles.metaLine}>
        <span>DECEMBER 02, 2025</span>
        <span>AWARD: A FREE WEBSITE FEEDBACK</span>
      </div>

      <div className={styles.timerLine}>
        <span className={styles.timerText}>
          TIME LEFT: {formatTime(timeLeft)}
        </span>
      </div>

      {/* Active Clue Bar */}
      <div className={styles.activeClueBar}>
        <span>{activeClueText}</span>
      </div>

      {isPuzzleSolved && (
        <div className={styles.completionMessage}>
          <h2>🎉 Puzzle Solved!</h2>
          <p>Click below to claim your <b>FREE Website Review</b>!</p>
          <button
            className={styles.claimButton}
            onClick={() => alert("Form Submission Simulated!")}
          >
            Claim Your Review!
          </button>
        </div>
      )}

      {/* --- ACROSS | GRID | DOWN --- */}
      <div className={styles.gameLayout}>
        {/* LEFT: ACROSS */}
        <div className={styles.clueBlock}>
          <h3 className={styles.clueheading}>ACROSS</h3>
          <ul>
            {clues.across.map((word) => (
              <li
                key={word.id}
                className={`${word.id === activeWordId ? styles.activeClue : ""
                  } ${solvedWords.has(word.id) ? styles.solvedClue : ""}`}
                onClick={() => {
                  setActiveWordId(word.id);
                  setActiveCell({
                    row: word.start.row,
                    col: word.start.col,
                  });
                }}
              >
                <span className={styles.clueId}>{word.id}.</span>{" "}
                {word.clue}
              </li>
            ))}
          </ul>
        </div>

        {/* CENTER: GRID */}
        <div className={styles.gridWrapper}>
          <table className={styles.grid}>
            <tbody>
              {grid.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => {
                    const isBlocked = cell.letter === null;

                    const isActiveCell =
                      activeCell?.row === rowIndex &&
                      activeCell?.col === colIndex;

                    const isActiveWordCell =
                      activeWordId !== null &&
                      cell.wordIds.includes(activeWordId);

                    const isSolvedCell =
                      cell.wordIds.length > 0 &&
                      cell.wordIds.every((id) => solvedWords.has(id));

                    return (
                      <td
                        key={colIndex}
                        className={`${styles.cell} ${
                          isBlocked ? styles.blank : styles.playableCell
                        }`}
                        onClick={() =>
                          !isBlocked &&
                          handleCellClick(rowIndex, colIndex, cell)
                        }
                      >
                        {!isBlocked && (
                          <div
                            className={`${styles.cellContent} ${
                              isActiveCell ? styles.activeCell : ""
                            } ${
                              isActiveWordCell ? styles.activeWord : ""
                            } ${isSolvedCell ? styles.solvedCell : ""}`}
                          >
                            {cell.clueNumber && (
                              <span className={styles.clueNumber}>
                                {cell.clueNumber}
                              </span>
                            )}
                            <input
                              id={`cell-${rowIndex}-${colIndex}`}
                              type="text"
                              maxLength={1}
                              value={cell.displayLetter}
                              onChange={(e) =>
                                handleCellChange(e, rowIndex, colIndex)
                              }
                              className={styles.inputLetter}
                              tabIndex={-1}
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT: DOWN */}
        <div className={styles.clueBlock}>
          <h3>DOWN</h3>
          <ul>
            {clues.down.map((word) => (
              <li
                key={word.id}
                className={`${word.id === activeWordId ? styles.activeClue : ""
                  } ${solvedWords.has(word.id) ? styles.solvedClue : ""}`}
                onClick={() => {
                  setActiveWordId(word.id);
                  setActiveCell({
                    row: word.start.row,
                    col: word.start.col,
                  });
                }}
              >
                <span className={styles.clueId}>{word.id}.</span>{" "}
                {word.clue}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
