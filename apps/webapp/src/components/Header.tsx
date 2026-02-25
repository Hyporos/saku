const Header = () => {
  return (
    <section className="flex justify-center bg-panel h-[80px]">
      <div className="flex justify-between items-center px-12 w-full max-w-[1440px]">
        <div className="flex items-center gap-24">
          <button className="flex items-center gap-9" onClick={() => {}}>
            <img src="src\assets\logo.webp" width={48} height={48} />
            <h1 className="text-4xl">Saku</h1>
          </button>
          <nav className="flex gap-12">
            <button>Dashboard</button>
            <button>Rankings</button>
            <button>Documentation</button>
          </nav>
        </div>
        <div className="flex items-center gap-12">
          <button>Admin Panel</button>
          <button>
            <img
              className="border-2 border-accent rounded-full"
              src="src\assets\logo.webp"
              width={45}
              height={45}
            />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Header;
