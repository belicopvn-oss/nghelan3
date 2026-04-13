export type QuestionType = 'multiple-choice' | 'matching';

export interface Question {
  id: string;
  question: string;
  options: Record<string, string>;
  correct: string;
  type: QuestionType;
}

export interface PracticeSet {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export interface UserAnswer {
  practiceId: string;
  questionId: string;
  answer: string;
}

export interface PracticeResult {
  practiceId: string;
  score: number;
  total: number;
  answers: Record<string, string>;
  timestamp: number;
}
