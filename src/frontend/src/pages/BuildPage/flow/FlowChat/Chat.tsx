import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";

export default function Chat({
    stop = false,
    logo = '',
    clear = false,
    questions = [],
    form = false,
    useName,
    inputForm = null,
    guideWord,
    wsUrl,
    onBeforSend,
    loadMore = () => { }
}) {

    return <div className="relative h-full">
        <ChatMessages logo={logo} useName={useName} guideWord={guideWord} loadMore={loadMore}></ChatMessages>
        <ChatInput clear={clear} questions={questions} form={form} wsUrl={wsUrl} inputForm={inputForm} onBeforSend={onBeforSend} ></ChatInput>
    </div>
};