import EDFUpload from "../components/EDFUpload";
//import ColumnSelector from "../components/ColumnSelector";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-blue-200 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-10">
        {/* Naslov */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 flex justify-center items-center gap-3">
            <img src="/icon.svg" alt="Logo" className="w-10 h-10" />
            Analiza Polisomnografskih Podataka
          </h1>
          <p className="text-gray-500 mt-2">
            Učitaj EDF zapis cjelonoćnog polisomnografa i istraži podatke interaktivno.
          </p>
          <EDFUpload />
        </div>
      </div>
    </div>
  );
}