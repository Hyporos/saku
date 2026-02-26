import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import updateLocale from "dayjs/plugin/updateLocale";
import { PreviousScore } from "../components/PreviousScore";
import Graph from "../components/Graph";
import { ChatMessage } from "../components/ChatMessage";
import useCharacter from "../hooks/useCharacter";
dayjs.extend(utc);
dayjs.extend(updateLocale);

const Dashboard = () => {
  // Character object
  const characterData = useCharacter("dánnis");

  // Set the day of the week that the culvert score gets reset (Sunday)
  dayjs.updateLocale("en", {
    weekStart: 4,
  });

  const reset = dayjs()
    .utc()
    .startOf("week")
    .subtract(1, "day")
    .format("YYYY-MM-DD");

  // Get the current score of the character
  const getCurrentScore = () => {
    if (
      !characterData.scores ||
      characterData.scores[characterData.scores.length - 1]?.date !== reset
    )
      return 0;

    return characterData.scores[
      characterData.scores.length - 1
    ].score.toLocaleString();
  };

  // Get the best score of the character
  const getPersonalBest = () => {
    if (!characterData.scores) return 0;

    return Math.max(
      ...characterData.scores.map((score) => score.score),
      0
    ).toLocaleString();
  };

  // Get the participation rate of the character
  const getParticipationRate = () => {
    if (!characterData.scores) return "0/0 (0%)";

    const totalScores = characterData.scores.length;

    const missedScores = characterData.scores.filter(
      (score) => score.score === 0
    ).length;

    return `${totalScores - missedScores}/${totalScores} (${Math.round(
      ((totalScores - missedScores) / totalScores) * 100
    )}%)`;
  };

  // Get the trend for the character's score list
  const getScoreState = (
    score: { score: number },
    index: number,
    scores: { score: number }[]
  ) => {
    if (score.score === 0) return "invalid";

    return index === 0 || score.score > scores[index - 1].score
      ? "uptrend"
      : "downtrend";
  };

  // Get the lifetime score of the character
  const getLifetimeScore = () => {
    const sum = characterData.scores.reduce((accumulator, score) => {
      return accumulator + score.score;
    }, 0);

    return sum.toLocaleString();
  };

  return (
    <section className="flex justify-center items-center gap-x-6 p-12 h-full">
      {/* Live Chat & Feed */}
      <div className="bg-panel rounded-xl w-full h-full max-w-[375px]">
        <div className="flex flex-col justify-between items-center bg-panel rounded-xl p-8 h-full">
          <h1 className="text-xl">Saku - Live Chat & Feed</h1>

          <div className="bg-tertiary/20 rounded-full w-full h-px" />

          <div className="flex flex-col gap-3 overflow-y-auto w-full h-full max-h-[420px]">
            <ChatMessage
              characterImgURL={characterData.characterImgURL as string}
              characterName={characterData.name}
              message="yo i'm actually so raw. bro im so raw. omg i'm raw af. someone tell me why i'm so raw"
            />
          </div>

          <div className="bg-tertiary/20 rounded-full w-full h-px" />

          <h1 className="text-lg">
            Lifetime Score:{" "}
            <span className="text-accent">{getLifetimeScore()}</span>
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full h-full max-w-[545px]">
        {/* Character Info */}
        <div className="flex items-center justify-center bg-panel rounded-xl gap-16 px-8 py-4 h-[105px]">
          <img src={characterData.characterImgURL} />
          <div>
            <h1 className="text-xl text-accent text-center">
              {characterData.name}
            </h1>
            <div className="flex justify-center">
              <h2>
                Level {characterData.level} {characterData.characterClassName}
              </h2>
            </div>
            <h2 className="flex justify-between gap-2">
              <h2>Member Since:</h2>
              <h2 className="text-accent">
                {dayjs(characterData.memberSince).format("MMM D YYYY")}
              </h2>
            </h2>
          </div>
        </div>

        {/* Current / Best Score */}
        <div className="flex text-center gap-6 h-[80px]">
          <div className="flex flex-col justify-center bg-panel rounded-xl px-8 py-4 w-full">
            <h1 className="text-xl">Current Score</h1>
            <h2 className="text-xl text-accent">{getCurrentScore()}</h2>
          </div>
          <div className="flex flex-col justify-center bg-panel rounded-xl px-8 py-4 w-full">
            <h1 className="text-xl">Personal Best</h1>
            <h2 className="text-xl text-accent">{getPersonalBest()}</h2>
          </div>
        </div>

        {/* Culvert Graph */}
        <div className="flex flex-col justify-between items-center bg-panel rounded-xl p-8 h-full">
          <h1 className="text-xl">Culvert Graph</h1>
          <div className="bg-tertiary/20 rounded-full w-full h-px m-6" />
          <Graph />
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full h-full max-w-[375px]">
        {/* Previous Scores */}
        <div className="flex flex-col justify-between items-center bg-panel rounded-xl p-8 h-full">
          <h1 className="text-xl">Previous Scores</h1>

          <div className="bg-tertiary/20 rounded-full w-full h-px" />

          <div className="flex flex-col gap-3 overflow-y-auto w-full h-full max-h-[420px]">
            {characterData.scores
              .map((score, index, scores) => (
                <PreviousScore
                  key={score.date}
                  state={getScoreState(score, index, scores)}
                  date={score.date}
                  score={score.score}
                />
              ))
              .reverse()}
          </div>

          <div className="bg-tertiary/20 rounded-full w-full h-px" />

          <h1 className="text-lg">
            Lifetime Score:{" "}
            <span className="text-accent">{getLifetimeScore()}</span>
          </h1>
        </div>

        {/* Participation Rate */}
        <div className="flex flex-col justify-center items-center bg-panel rounded-xl px-8 py-4 h-[80px]">
          <h1 className="text-xl">Participation Rate</h1>
          <h2 className="text-accent">{getParticipationRate()}</h2>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
