export const Choice = Object.freeze({
  Rock: 0,
  Paper: 1,
  Scissors: 2,
} as const);

export type Choice = (typeof Choice)[keyof typeof Choice];

export const choiceToString = (
  choice: Choice
): "rock" | "paper" | "scissors" => {
  switch (choice) {
    case Choice.Rock:
      return "rock";
    case Choice.Paper:
      return "paper";
    case Choice.Scissors:
      return "scissors";
  }
};
