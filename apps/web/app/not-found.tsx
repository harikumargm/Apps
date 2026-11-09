import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page py-24">
      <p className="eyebrow">404</p>
      <h1 className="serif text-6xl">That piece has left the edit.</h1>
      <Link to="/catalog" className="btn btn-solid mt-8">
        Back to the catalog
      </Link>
    </div>
  );
}
