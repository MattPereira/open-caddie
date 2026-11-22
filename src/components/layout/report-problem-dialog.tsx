"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { reportProblem } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PROBLEM_REPORT_DESCRIPTION_MAX,
  PROBLEM_REPORT_TITLE_MAX,
  ProblemReportSchema,
  type ProblemReportInput,
} from "@/modules/problem-reports";

const EMPTY_REPORT: ProblemReportInput = { title: "", description: "" };

export function ReportProblemDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const form = useForm<ProblemReportInput>({
    resolver: zodResolver(ProblemReportSchema),
    defaultValues: EMPTY_REPORT,
  });
  const serverError = form.formState.errors.root?.server?.message;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && issueUrl) {
      setIssueUrl(null);
      form.reset(EMPTY_REPORT);
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = (values: ProblemReportInput) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result = await reportProblem({
        ...values,
        path: window.location.pathname + window.location.search,
        viewport: window.innerWidth,
      });
      if (!result.ok) {
        form.setError("root.server", { type: "server", message: result.error });
        return;
      }
      setIssueUrl(result.url);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>
            {issueUrl
              ? "Thanks. The report is on GitHub."
              : "Reports are filed publicly on GitHub, so don't include personal details."}
          </DialogDescription>
        </DialogHeader>

        {issueUrl ? (
          <>
            <p className="text-sm">
              Issue filed:{" "}
              <a
                href={issueUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary underline underline-offset-4"
              >
                {issueUrl}
              </a>
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              {serverError ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {serverError}
                </p>
              ) : null}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input maxLength={PROBLEM_REPORT_TITLE_MAX} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What went wrong?</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        maxLength={PROBLEM_REPORT_DESCRIPTION_MAX}
                        className="max-h-64 overflow-y-auto"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  Submit
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
