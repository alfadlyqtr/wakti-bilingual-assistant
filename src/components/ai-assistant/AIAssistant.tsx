
import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModePanel } from "@/components/ai-assistant/ModePanel";
import { useTheme } from "@/providers/ThemeProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";

export const AIAssistant = () => {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<
    { type: "user" | "assistant"; text: string }[]
  >([]);
  const [activeMode, setActiveMode] = useState("general");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskDetails, setTaskDetails] = useState({
    title: "",
    description: "",
    dueDate: undefined as Date | undefined,
    priority: "medium",
    isRecurring: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const { theme, language } = useTheme();

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setProgress(30);

    setChatHistory((prev) => [...prev, { type: "user", text: input }]);
    setInput("");

    // Simulate assistant response with a loading progress
    setTimeout(() => {
      setProgress(70);
      setTimeout(() => {
        const assistantResponse = `Echo: ${input} in ${activeMode} mode.`;
        setChatHistory((prev) => [
          ...prev,
          { type: "assistant", text: assistantResponse },
        ]);
        setProgress(100);
        setIsLoading(false);
        setProgress(0);
        if (input.toLowerCase().includes("create task")) {
          setIsCreatingTask(true);
        }
      }, 1000);
    }, 1500);
  };

  const handleTaskInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setTaskDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaskCheckboxChange = (checked: boolean) => {
    setTaskDetails((prev) => ({ ...prev, isRecurring: checked }));
  };

  const handleTaskDateChange = (date: Date | undefined) => {
    setTaskDetails((prev) => ({ ...prev, dueDate: date }));
  };

  const handleCreateTask = () => {
    console.log("Creating task with details:", taskDetails);
    setIsCreatingTask(false);
    setTaskDetails({
      title: "",
      description: "",
      dueDate: undefined,
      priority: "medium",
      isRecurring: false,
    });
  };

  const requiredMode = "assistant";
  return (
    <div className="flex flex-col h-full">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("waktiAssistant" as TranslationKey, language)}</CardTitle>
          <CardDescription>
            {isLoading ? (
              <Progress value={progress} />
            ) : (
              t("welcomeToWaktiAI" as TranslationKey, language)
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <ModePanel activeMode={activeMode} setActiveMode={setActiveMode} />

      <Separator />

      <div
        className="flex-grow overflow-y-auto p-4"
        ref={chatHistoryRef}
        style={{ scrollBehavior: "smooth" }}
      >
        {chatHistory.map((message, index) => (
          <div
            key={index}
            className={`mb-2 flex items-start ${
              message.type === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.type === "assistant" && (
              <Avatar className="mr-2">
                <AvatarImage src="/wakti-logo-square.png" alt="WAKTI AI" />
                <AvatarFallback>W</AvatarFallback>
              </Avatar>
            )}
            <div
              className={`rounded-lg p-3 w-fit max-w-[80%] ${
                message.type === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="mb-2 flex items-start justify-start">
            <Avatar className="mr-2">
              <AvatarImage src="/wakti-logo-square.png" alt="WAKTI AI" />
              <AvatarFallback>W</AvatarFallback>
            </Avatar>
            <div className="rounded-lg p-3 w-fit max-w-[80%] bg-secondary text-secondary-foreground">
              <p className="text-sm">{t("writingContent" as TranslationKey, language)}</p>
            </div>
          </div>
        )}
        {isCreatingTask && (
          <div className="p-4 bg-accent rounded-lg mb-4">
            <p className="font-medium">
              {t("iCanCreateThisTask" as TranslationKey, language)}
            </p>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  {t("title" as TranslationKey, language)}
                </Label>
                <Input
                  type="text"
                  id="title"
                  name="title"
                  value={taskDetails.title}
                  onChange={handleTaskInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  {t("description" as TranslationKey, language)}
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={taskDetails.description}
                  onChange={handleTaskInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dueDate" className="text-right">
                  {t("dueDate" as TranslationKey, language)}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !taskDetails.dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskDetails.dueDate ? (
                        format(taskDetails.dueDate, "PPP")
                      ) : (
                        <span>{t("selectDate" as TranslationKey, language)}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center" side="bottom">
                    <Calendar
                      mode="single"
                      selected={taskDetails.dueDate}
                      onSelect={handleTaskDateChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priority" className="text-right">
                  {t("priority" as TranslationKey, language)}
                </Label>
                <select
                  id="priority"
                  name="priority"
                  value={taskDetails.priority}
                  onChange={handleTaskInputChange}
                  className="col-span-3 rounded-md border appearance-none bg-background px-4 py-2 focus:outline-none focus:border-primary"
                >
                  <option value="low">{t("low" as TranslationKey, language)}</option>
                  <option value="medium">{t("medium" as TranslationKey, language)}</option>
                  <option value="high">{t("high" as TranslationKey, language)}</option>
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isRecurring" className="text-right">
                  {t("recurring" as TranslationKey, language)}
                </Label>
                <Checkbox
                  id="isRecurring"
                  checked={taskDetails.isRecurring}
                  onCheckedChange={handleTaskCheckboxChange}
                  className="col-span-3"
                />
              </div>
            </div>
            <Button onClick={handleCreateTask}>{t("createTask" as TranslationKey, language)}</Button>
          </div>
        )}
        {!isLoading &&
          isCreatingTask &&
          activeMode !== requiredMode && (
            <div className="p-4 bg-accent rounded-lg mb-4">
              <p className="font-medium">
                {`${t("toCompleteThisAction" as TranslationKey, language)} ${t(
                  "switchTo" as TranslationKey,
                  language
                )} ${requiredMode} ${t(
                  "hereIsWhatIUnderstood" as TranslationKey,
                  language
                )}`}
              </p>
            </div>
          )}
      </div>

      <Separator />

      <div className="p-4 flex items-center">
        <Input
          type="text"
          placeholder={t("askWAKTI" as TranslationKey, language)}
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === "Enter" ? handleSendMessage() : null}
          className="mr-2"
        />
        <Button onClick={handleSendMessage} disabled={isLoading}>
          {t("send" as TranslationKey, language)}
        </Button>
      </div>
    </div>
  );
};
