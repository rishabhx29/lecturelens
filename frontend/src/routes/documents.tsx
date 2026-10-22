import React, { useState } from "react";
import WelcomeHero from "../components/WelcomeHero";
import DocumentUploader from "../components/DocumentUploader";
import DocumentList from "../components/DocumentList";

const Documents: React.FC = () => {
  const [documentListKey, setDocumentListKey] = useState(1);
  const reloadDocuments = () => {
    setTimeout(() => setDocumentListKey(Math.random()), 1000);
  };

  return (
    <div className="pb-2">
      <WelcomeHero />
      <DocumentUploader onDocumentUploaded={reloadDocuments} />
      <DocumentList key={documentListKey} />
    </div>
  );
};

export default Documents;
