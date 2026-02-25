import axios from "axios";
import { useEffect, useState } from "react";

const useCharacter = (characterName: string) => {
  const [characterData, setCharacterData] = useState<{
    name: string;
    class: string;
    level?: number;
    characterImgURL?: string;
    memberSince: string;
    scores: { score: number; date: string }[];
  }>({
    name: "",
    class: "",
    level: NaN,
    characterImgURL: "",
    memberSince: "",
    scores: [],
  });

  useEffect(() => {
    // Saku Bot API (MongoDB)
    axios
      .get(`http://localhost:3000/api/character/${characterName}`)
      .then((res) => {
        setCharacterData((prevData) => ({
          ...prevData,
          name: res.data.name,
          class: res.data.class,
          memberSince: res.data.memberSince,
          scores: res.data.scores,
        }));
      })
      .catch((error) => {
        console.error("Error fetching character:", error);
      });

    // Saku Bot API (MapleStory Rankings)
    axios
      .get(`http://localhost:3000/api/rankings/${characterName}`)
      .then((res) => {
        setCharacterData((prevData) => ({
          ...prevData,
          characterImgURL: res.data.characterImgURL,
          level: res.data.level,
        }));
      })
      .catch((error) => {
        console.error("Error fetching character:", error);
      });
  }, []);

  return characterData;
};

export default useCharacter;
