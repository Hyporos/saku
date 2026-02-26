import axios from "axios";
import { useEffect, useState } from "react";

// Route through server.js proxy to avoid Mixed Content / CORS issues
const BOT_API = import.meta.env.VITE_BOT_API_URL ?? "http://localhost:8000";

const useCharacter = (characterName: string) => {
  const [characterData, setCharacterData] = useState<{
    name: string;
    characterClassName: string;
    level?: number;
    characterImgURL?: string;
    memberSince: string;
    scores: { score: number; date: string }[];
  }>({
    name: "",
    characterClassName: "",
    level: NaN,
    characterImgURL: "",
    memberSince: "",
    scores: [],
  });

  useEffect(() => {
    // Saku Bot API (MongoDB)
    axios
      .get(`${BOT_API}/bot/api/character/${characterName}`)
      .then((res) => {
        setCharacterData((prevData) => ({
          ...prevData,
          name: res.data.name,
          memberSince: res.data.memberSince,
          scores: res.data.scores,
        }));
      })
      .catch((error) => {
        console.error("Error fetching character:", error);
      });

    // Saku Bot API (MapleStory Rankings)
    axios
      .get(`${BOT_API}/bot/api/rankings/${characterName}`)
      .then((res) => {
        setCharacterData((prevData) => ({
          ...prevData,
          characterImgURL: res.data.characterImgURL,
          level: res.data.level,
          characterClassName: res.data.characterClassName ?? "",
        }));
      })
      .catch((error) => {
        console.error("Error fetching character:", error);
      });
  }, []);

  return characterData;
};

export default useCharacter;
