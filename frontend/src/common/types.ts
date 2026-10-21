export interface Document {
  documentid: string;
  userid: string;
  filename: string;
  filesize: string;
  docstatus: string;
  created: string;
  pages: string;
  conversations: {
    conversationid: string;
    created: string;
  }[];
}

export interface Conversation {
  conversationid: string;
  document: Document;
  messages: {
    type: string;
    data: {
      content: string;
      example: boolean;
      additional_kwargs: Record<string, unknown>;
    };
  }[];
}

export type StudyPackStatus =
  | "NOT_GENERATED"
  | "QUEUED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export interface StudyPackKeyConcept {
  term: string;
  definition: string;
}

export interface StudyPackFlashcard {
  front: string;
  back: string;
}

export interface StudyPackQuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface StudyPack {
  title: string;
  summary: string;
  keyConcepts: StudyPackKeyConcept[];
  flashcards: StudyPackFlashcard[];
  quiz: StudyPackQuizQuestion[];
}

export interface StudyPackResponse {
  status: StudyPackStatus;
  studyPack: StudyPack | null;
  updated: string | null;
  error: string | null;
}
