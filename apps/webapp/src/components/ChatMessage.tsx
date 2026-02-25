interface ChatMessageProps {
  characterImgURL: string;
  characterName: string;
  message: string;
}

const ChatMessage = ({
  characterImgURL,
  characterName,
  message,
}: ChatMessageProps) => {
  return (
    <div className="flex justify-between items-center bg-background text-sm rounded-2xl drop-shadow-[0_0_4px_rgba(0,0,0,0.25)] px-4 py-2 max-h-[55px]">
      <img
        className="rounded-full mr-4"
        src={characterImgURL}
        width={40}
        height={40}
      />
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <p className="text-xs text-accent">{characterName}</p>
          <p className="text-xs font-normal text-tertiary/50">Today at 5:29 PM</p>
        </div>
        <p className="text-end">{message}</p>
      </div>
    </div>
  );
};

export { ChatMessage };
