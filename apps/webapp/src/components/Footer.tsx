const Footer = () => {
  return (
    <section className="flex justify-center bg-panel h-[80px]">
      <div className="flex justify-center items-center px-12 w-full max-w-[1440px]">
        <p className="text-tertiary text-[16px]">© 2024 Saku</p>
      </div>
    </section>
  );
};

export default Footer;

// TODO WEBAPP: Action History, Error Console, Crash Log, Cron Job Manager, Backfill Trigger, growth trends, server status, 
// TODO WEBAPP: clean up page, with functions like purge empty users,  check users with 2 characters, data anomalies, missing scores
// TODO Check Rename

// TODO NOW: Create a toggle on the scores tab page, to the left of the 'All Dates' filter button, that toggles between regular view and a view that shows characters that have not inputted a score for the current week / Missing Scores.