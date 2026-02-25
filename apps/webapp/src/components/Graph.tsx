import {
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  TooltipProps,
  Area,
  ResponsiveContainer,
} from "recharts";
import {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";
import dayjs from "dayjs";
import useCharacter from "../hooks/useCharacter";

const Graph = () => {
  const characterData = useCharacter("dánnis");

  // Get the last 8 scores
  const graphData = characterData.scores.slice(-8).map((score) => ({
    date: dayjs(score.date).format("MM/DD"),
    score: score.score,
  }));

  // Render a custom tooltip for the graph
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<ValueType, NameType>) => {
    // If props do not exist, return null
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col bg-background rounded-lg drop-shadow-[0_0_4px_rgba(0,0,0,0.25)] space-y-1 p-4">
        <p className="text-tertiary font-light">{label}</p>
        <p className="text-accent text-sm font-light">Score : {payload[0].value}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="80%">
      <AreaChart
        width={500}
        height={400}
        data={graphData}
        margin={{
          top: 10,
          right: 20,
          left: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FFBDD599" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#FFBDD599" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <RechartsTooltip
          cursor={{ stroke: "#C2C2C299", strokeWidth: 1.5 }}
          content={<CustomTooltip />}
        />
        <CartesianGrid stroke="#C2C2C215" />
        <XAxis
          dataKey="date"
          stroke="#C2C2C299"
          tickMargin={10}
          tick={{ fontSize: 14 }}
        />
        <YAxis
          dataKey="score"
          stroke="#C2C2C299"
          tickMargin={10}
          tick={{ fontSize: 14 }}
          domain={[
            0,
            Math.ceil(
              Math.max(...characterData.scores.map((score) => score.score), 0) /
                5000
            ) * 5000,
          ]}
        />
        <Area
          isAnimationActive={false}
          dataKey="score"
          stroke="#FFBDD599"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#gradient)"
          dot={{
            stroke: "#FFBDD5",
            r: 0.5,
          }}
          activeDot={{
            stroke: "#FFBDD5",
            r: 1.5,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default Graph;
