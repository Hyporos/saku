import Footer from "./components/Footer";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <div className="flex flex-col justify-between h-dvh">
      <Header />
      <Dashboard />
      <Footer />
    </div>
  );
}

export default App;