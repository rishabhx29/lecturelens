import React, { useState, useEffect, KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get, post } from "aws-amplify/api";
import { Conversation } from "../common/types";
import ChatSidebar from "../components/ChatSidebar";
import ChatMessages from "../components/ChatMessages";
import StudyPackModal from "../components/StudyPackModal";
import LoadingGrid from "../../public/loading-grid.svg";

const Document: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = React.useState<string>("idle");
  const [messageStatus, setMessageStatus] = useState<string>("idle");
  const [conversationListStatus, setConversationListStatus] = useState<
    "idle" | "loading"
  >("idle");
  const [prompt, setPrompt] = useState("");
  const [studyPackOpen, setStudyPackOpen] = useState(false);

  const fetchData = async (conversationid = params.conversationid) => {
    setLoading("loading");
    try {
      const response = await get({
        apiName: "serverless-pdf-chat",
        path: `doc/${params.documentid}/${conversationid}`,
      }).response;
      const conversation = (await response.body.json()) as unknown as Conversation;
      setConversation(conversation);
    } catch (error) {
      console.error("Failed to load conversation", error);
    } finally {
      setLoading("idle");
    }
  };

  useEffect(() => {
    fetchData();
    // Intentionally runs once on mount for the route's initial conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const addConversation = async () => {
    setConversationListStatus("loading");
    const response = await post({
      apiName: "serverless-pdf-chat",
      path: `doc/${params.documentid}`
    }).response;
    const newConversation = await response.body.json() as unknown as Conversation;
    fetchData(newConversation.conversationid);
    navigate(`/doc/${params.documentid}/${newConversation.conversationid}`);
    setConversationListStatus("idle");
  };

  const switchConversation = (e: React.MouseEvent<HTMLButtonElement>) => {
    const targetButton = e.target as HTMLButtonElement;
    navigate(`/doc/${params.documentid}/${targetButton.id}`);
    fetchData(targetButton.id);
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key == "Enter") {
      submitMessage();
    }
  };

  const submitMessage = async () => {
    if (
      !conversation ||
      conversation.document.docstatus !== "READY" ||
      !prompt.trim()
    ) {
      return;
    }

    setMessageStatus("loading");
    const previewMessage = {
      type: "text",
      data: {
        content: prompt,
        additional_kwargs: {},
        example: false,
      },
    };

    setConversation({
      ...conversation,
      messages: [...conversation.messages, previewMessage],
    });

    try {
      await post({
        apiName: "serverless-pdf-chat",
        path: `${conversation.document.documentid}/${conversation.conversationid}`,
        options: {
          body: {
            fileName: conversation.document.filename,
            prompt: prompt,
          },
        },
      }).response;
      setPrompt("");
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      await fetchData(conversation.conversationid);
      setMessageStatus("idle");
    }
  };

  return (
    <div className="">
      {loading === "loading" && !conversation && (
        <div className="flex flex-col items-center mt-6">
          <img src={LoadingGrid} width={40} />
        </div>
      )}
      {conversation && (
        <div className="grid grid-cols-12 border border-gray-200 rounded-lg">
          <ChatSidebar
            conversation={conversation}
            params={params}
            addConversation={addConversation}
            switchConversation={switchConversation}
            conversationListStatus={conversationListStatus}
            onOpenStudyPack={() => setStudyPackOpen(true)}
          />
          <ChatMessages
            prompt={prompt}
            conversation={conversation}
            messageStatus={messageStatus}
            submitMessage={submitMessage}
            handleKeyPress={handleKeyPress}
            handlePromptChange={handlePromptChange}
          />
        </div>
      )}
      <StudyPackModal
        isOpen={studyPackOpen}
        onClose={() => setStudyPackOpen(false)}
        document={conversation?.document ?? null}
      />
    </div>
  );
};

export default Document;
