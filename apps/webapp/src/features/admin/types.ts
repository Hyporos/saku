import type { ReactNode } from "react";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export type Section = "users" | "characters" | "scores" | "exceptions";

export interface DrawerState {
  isOpen: boolean;
  mode: "edit" | "create";
  section: Section;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export interface ScoreEntry {
  _id?: string;
  date: string;
  score: number;
}

export interface Character {
  name: string;
  avatar: string;
  memberSince: string;
  graphColor: string;
  scores: ScoreEntry[];
}

export interface UserDoc {
  _id: string;
  graphColor: string;
  characters: Character[];
  username?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  joinedAt?: string | null;
  role?: "bee" | "member" | null;
}

export interface ExceptionDoc {
  _id: string;
  name: string;
  exception: string;
  [key: string]: unknown;
}

export type CharDetail = Character & {
  userId: string;
  scoreCount: number;
  participationRate: number;
};

export type UserDetail = UserDoc;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export type SortDir = "asc" | "desc";

export interface SortState {
  field: string;
  dir: SortDir;
}

export type ModalPayload =
  | {
      variant: "confirm";
      title: ReactNode;
      description: string;
      onConfirm: () => void;
      confirmLabel?: string;
      confirmDanger?: boolean;
    }
  | {
      variant: "sensitive";
      title: ReactNode;
      description: string;
      onConfirm: () => void;
      confirmWord?: string;
    };

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Derived / fetched shapes used internally

export type LiveUser = {
  id: string;
  graphColor: string;
  characterCount: number;
  username: string | null;
  nickname: string | null;
  role: string | null;
};

export type LiveScore = {
  _id?: string;
  character: string;
  userId: string;
  date: string;
  score: number;
};

export type PrevContext =
  | { type: "user"; userId: string; username: string | null }
  | { type: "char"; charName: string }
  | { type: "section"; section: "scores" | "exceptions" };

export type UserMemberData = {
  _id: string;
  username: string | null;
  nickname: string | null;
  role: string | null;
  joinedAt: string | null;
  avatarUrl: string | null;
};

export type OwnerData = {
  _id: string;
  username: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  joinedAt?: string | null;
  role?: string | null;
};

export type CharApiData = {
  level: number;
  characterImgURL: string;
  characterClassName?: string | null;
};

export type CharEdits = {
  memberSince: string;
  avatar: string;
  graphColor: string;
};

export type ScoreInlineEditState = {
  scoreId?: string;
  origDate: string;
  dateValue: string;
  scoreValue: string;
};

export type ScoreTabInlineEditState = {
  scoreId?: string;
  origCharacter: string;
  origDate: string;
  dateValue: string;
  scoreValue: string;
};

export type ExcInlineEditState = {
  id: string;
  name: string;
  exception: string;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export type ToolSection = "action-log" | "scanner";

export type ActionLogCategory = "create" | "edit" | "delete" | "transfer" | "rename";

export type ActionLogEntry = {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  details?: string;
  category: ActionLogCategory;
  actorId?: string | null;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Scanner

export type ScanResultEntry = {
  name: string;
  score: number;
  sandbag: boolean;
  isNaN: boolean;
};

export type ScanImageResult = {
  week: string;
  success: ScanResultEntry[];
  notFound: { name: string }[];
  nanScores: { name: string }[];
  zeroScores: { name: string }[];
  totalSuccess: number;
  totalFailure: number;
  totalScanned: number;
};

export type FinalizeResult = {
  success: boolean;
  missedCharacters: string[];
  total: number;
  submitted: number;
  week: string;
  backup?: string;
  backupFilename?: string;
};
