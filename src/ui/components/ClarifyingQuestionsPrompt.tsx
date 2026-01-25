/**
 * Clarifying questions prompt component.
 * Displays questions from the AskUserQuestion tool and collects answers.
 * Styled with a stepper progress bar showing question headers.
 * Features inline text input for the "Type something" option.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useWizard } from '../contexts/WizardContext.js';
import { PromptContainer } from './PromptContainer.js';
import type {
  ClarifyingQuestionsProps,
  ClarifyingQuestionsResult,
  ClarifyingQuestion,
} from '../types.js';

interface ClarifyingQuestionsPromptComponentProps {
  props: ClarifyingQuestionsProps;
}

interface ListItem {
  label: string;
  value: string;
  description?: string;
}

/**
 * Stepper progress bar component showing question headers with status indicators.
 */
function StepperProgress({
  questions,
  currentIndex,
  answers,
}: {
  questions: ClarifyingQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
}): React.ReactElement {
  // Add "Submit" as the final step
  const steps = [
    ...questions.map((q) => q.header),
    'Submit',
  ];

  return (
    <Box marginBottom={1}>
      {steps.map((header, idx) => {
        const isCompleted = idx < currentIndex || (idx < questions.length && answers[questions[idx].question]);
        const isCurrent = idx === currentIndex;

        // Determine the marker
        let marker: string;
        if (isCompleted && !isCurrent) {
          marker = '✓';
        } else if (isCurrent) {
          marker = '●';
        } else {
          marker = '○';
        }

        // Determine colors
        const markerColor = isCompleted ? 'green' : isCurrent ? 'cyan' : 'gray';
        const textColor = isCurrent ? 'cyan' : isCompleted ? undefined : 'gray';
        const textDim = !isCurrent && !isCompleted;

        return (
          <Box key={idx}>
            {/* Connector line before (except first) */}
            {idx > 0 && (
              <Text color="gray"> ━━━ </Text>
            )}
            {/* Marker and label */}
            <Box>
              <Text color={markerColor}>{marker}</Text>
              <Text color={textColor} dimColor={textDim}> {header}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Clarifying questions prompt for the AskUserQuestion tool.
 * Supports single-select, multi-select, and inline free-text input.
 */
export function ClarifyingQuestionsPrompt({
  props,
}: ClarifyingQuestionsPromptComponentProps): React.ReactElement {
  const { questions } = props;
  const { state, actions } = useWizard();
  const { resolvePending, addItem } = actions;
  const { agentState } = state;

  // Track current question index
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Track answers for each question
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Track multi-select selections for current question
  const [multiSelections, setMultiSelections] = useState<string[]>([]);
  // Track highlighted item index
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // Track custom text value for "Type something" option
  const [customText, setCustomText] = useState('');
  // Track if we're in typing mode (when Type something is selected and user is typing)
  const [isTypingMode, setIsTypingMode] = useState(false);
  // Track if we're in review mode (after all questions answered)
  const [isReviewMode, setIsReviewMode] = useState(false);
  // Track highlighted option in review mode (0 = Submit, 1 = Cancel)
  const [reviewHighlightedIndex, setReviewHighlightedIndex] = useState(0);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isMultiSelect = currentQuestion?.multiSelect ?? false;

  // Build list items for current question
  const items: ListItem[] = useMemo(() => {
    if (!currentQuestion) return [];

    const questionItems: ListItem[] = currentQuestion.options.map((opt) => ({
      label: opt.label,
      value: opt.label,
      description: opt.description,
    }));

    // Add "Type something" option for free-text input
    questionItems.push({
      label: 'Type something',
      value: '__OTHER__',
    });

    // Add "Submit" option for multi-select (always visible)
    if (isMultiSelect) {
      questionItems.push({
        label: 'Submit',
        value: '__SUBMIT__',
      });
    }

    return questionItems;
  }, [currentQuestion, isMultiSelect, multiSelections]);

  // Move to next question or go to review
  const proceedToNext = useCallback(
    (answer: string) => {
      const newAnswers = {
        ...answers,
        [currentQuestion.question]: answer,
      };
      setAnswers(newAnswers);

      if (isLastQuestion) {
        // All questions answered, go to review mode
        setIsReviewMode(true);
        setReviewHighlightedIndex(0);
      } else {
        // Move to next question
        setCurrentQuestionIndex((idx) => idx + 1);
        setMultiSelections([]);
        setHighlightedIndex(0);
        setCustomText('');
        setIsTypingMode(false);
      }
    },
    [answers, currentQuestion, isLastQuestion],
  );

  // Submit final answers
  const submitAnswers = useCallback(() => {
    // Add history item showing questions and answers
    addItem({
      type: 'clarifying-questions-result',
      text: "User answered Wizard's questions:",
      questionsAndAnswers: questions.map((q) => ({
        question: q.question,
        answer: answers[q.question] || '(no answer)',
      })),
    });

    const result: ClarifyingQuestionsResult = {
      questions,
      answers,
    };
    resolvePending(result);
  }, [questions, answers, resolvePending, addItem]);

  // Cancel and return empty answers, interrupting the agent
  const cancelAnswers = useCallback(() => {
    // Add history item indicating user declined
    addItem({
      type: 'declined-questions',
      text: 'User declined to answer questions',
    });

    // Interrupt the agent
    if (agentState.queryHandle?.interrupt) {
      agentState.queryHandle.interrupt();
    }

    const result: ClarifyingQuestionsResult = {
      questions,
      answers: {},
    };
    resolvePending(result);
  }, [questions, resolvePending, addItem, agentState.queryHandle]);

  // Handle custom text submission from TextInput
  const handleCustomTextSubmit = useCallback((value: string) => {
    if (!value.trim()) return;

    const trimmedValue = value.trim();
    
    if (isMultiSelect) {
      // Multi-select: Toggle checkbox, keep text
      if (multiSelections.includes(trimmedValue)) {
        setMultiSelections((prev) => prev.filter((v) => v !== trimmedValue));
      } else {
        setMultiSelections((prev) => [...prev, trimmedValue]);
      }
      // Don't clear text - keep it for further editing or submit
    } else {
      // Single-select: Submit immediately with the typed value
      proceedToNext(trimmedValue);
    }
  }, [isMultiSelect, multiSelections, proceedToNext]);

  // Handle keyboard navigation and selection
  useInput((input, key) => {
    // Review mode has its own navigation
    if (isReviewMode) {
      if (key.escape) {
        // Go back to last question
        setIsReviewMode(false);
        setHighlightedIndex(0);
        return;
      }
      if (key.upArrow) {
        setReviewHighlightedIndex((idx) => Math.max(0, idx - 1));
        return;
      }
      if (key.downArrow) {
        setReviewHighlightedIndex((idx) => Math.min(1, idx + 1));
        return;
      }
      if (key.return) {
        if (reviewHighlightedIndex === 0) {
          submitAnswers();
        } else {
          cancelAnswers();
        }
        return;
      }
      return;
    }

    // Escape handling - always active
    if (key.escape) {
      if (isTypingMode) {
        // Exit typing mode
        setIsTypingMode(false);
      } else if (currentQuestionIndex > 0) {
        // Go back to previous question
        setCurrentQuestionIndex((idx) => idx - 1);
        setMultiSelections([]);
        setHighlightedIndex(0);
        setCustomText('');
      } else {
        // On first question, cancel entirely
        cancelAnswers();
      }
      return;
    }

    // Arrow keys - exit typing mode and navigate
    if (key.upArrow) {
      if (isTypingMode) {
        setIsTypingMode(false);
      }
      setHighlightedIndex((idx) => Math.max(0, idx - 1));
      return;
    }
    if (key.downArrow) {
      if (isTypingMode) {
        setIsTypingMode(false);
      }
      setHighlightedIndex((idx) => Math.min(items.length - 1, idx + 1));
      return;
    }

    // Skip other keys when typing - TextInput handles them
    if (isTypingMode) {
      return;
    }

    // Enter to select
    if (key.return) {
      const selectedItem = items[highlightedIndex];
      if (!selectedItem) return;

      if (selectedItem.value === '__OTHER__') {
        // Enter typing mode
        setIsTypingMode(true);
        return;
      }

      if (selectedItem.value === '__SUBMIT__') {
        // Submit with all selections plus any text in the input
        const allSelections = [...multiSelections];
        if (customText.trim() && !allSelections.includes(customText.trim())) {
          allSelections.push(customText.trim());
        }
        if (allSelections.length > 0) {
          proceedToNext(allSelections.join(', '));
        }
        return;
      }

      if (isMultiSelect) {
        // Toggle selection for multi-select
        setMultiSelections((prev) => {
          if (prev.includes(selectedItem.value)) {
            return prev.filter((v) => v !== selectedItem.value);
          }
          return [...prev, selectedItem.value];
        });
      } else {
        // Single select - proceed immediately
        proceedToNext(selectedItem.value);
      }
    }
  });

  // Get custom entries (values in multiSelections that aren't regular options)
  const regularOptionValues = useMemo(() => {
    if (!currentQuestion) return new Set<string>();
    return new Set(currentQuestion.options.map((opt) => opt.label));
  }, [currentQuestion]);

  const customEntries = useMemo(() => {
    return multiSelections.filter((v) => !regularOptionValues.has(v));
  }, [multiSelections, regularOptionValues]);

  // Render a single list item
  const renderItem = (item: ListItem, index: number) => {
    const isHighlighted = index === highlightedIndex;
    const isSelected = multiSelections.includes(item.value);
    const isTypeOption = item.value === '__OTHER__';
    const isSubmitOption = item.value === '__SUBMIT__';
    const displayNumber = index + 1;

    // Indicator arrow
    const indicator = isHighlighted ? '› ' : '  ';

    // For "Type something" option with inline text input
    if (isTypeOption) {
      // Show checkbox only for multi-select
      const hasCustomEntries = customEntries.length > 0;
      const checkbox = isMultiSelect
        ? hasCustomEntries ? '[✓] ' : '[ ] '
        : '';
      
      return (
        <Box key={item.value}>
          <Text color={isHighlighted ? 'cyan' : undefined}>
            {indicator}
            {displayNumber}. {checkbox}
          </Text>
          {isTypingMode || customText ? (
            <TextInput
              value={customText}
              onChange={setCustomText}
              onSubmit={handleCustomTextSubmit}
              focus={isTypingMode}
              placeholder=""
            />
          ) : (
            <Text color={isHighlighted ? 'cyan' : undefined}>
              {item.label}
            </Text>
          )}
        </Box>
      );
    }

    // Submit option
    if (isSubmitOption) {
      const canSubmit = multiSelections.length > 0 || customText.trim();
      const textColor = isHighlighted ? 'cyan' : !canSubmit ? 'gray' : undefined;
      return (
        <Box key={item.value}>
          <Text color={textColor}>{indicator}</Text>
          <Text color={textColor}>Submit</Text>
        </Box>
      );
    }

    // Regular option - show checkbox for multi-select mode
    const checkbox = isMultiSelect
      ? isSelected
        ? '[✓] '
        : '[ ] '
      : '';

    return (
      <Box key={item.value}>
        <Text color={isHighlighted ? 'cyan' : undefined}>
          {indicator}
          {displayNumber}. {checkbox}{item.label}
        </Text>
        {item.description && (
          <Text dimColor> ({item.description})</Text>
        )}
      </Box>
    );
  };

  if (!currentQuestion && !isReviewMode) {
    return (
      <Box>
        <Text color="red">No questions to display</Text>
      </Box>
    );
  }

  // Review mode - show all answers and confirm
  if (isReviewMode) {
    return (
      <PromptContainer>
        {/* Stepper progress bar - show Submit as current */}
        <StepperProgress
          questions={questions}
          currentIndex={questions.length}
          answers={answers}
        />

        {/* Review header */}
        <Box marginBottom={1}>
          <Text bold>Review your answers</Text>
        </Box>

        {/* List all questions and answers */}
        <Box flexDirection="column" marginBottom={1}>
          {questions.map((q) => (
            <Box key={q.question} flexDirection="column" marginLeft={1}>
              <Box>
                <Text color="blue">● </Text>
                <Text>{q.question}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text color="gray">→ </Text>
                <Text color="green">{answers[q.question] || '(no answer)'}</Text>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Confirmation prompt */}
        <Box marginBottom={1}>
          <Text>Ready to submit your answers?</Text>
        </Box>

        {/* Submit/Cancel options */}
        <Box flexDirection="column">
          <Box>
            <Text color={reviewHighlightedIndex === 0 ? 'cyan' : undefined}>
              {reviewHighlightedIndex === 0 ? '› ' : '  '}1. Submit answers
            </Text>
          </Box>
          <Box>
            <Text color={reviewHighlightedIndex === 1 ? 'cyan' : undefined}>
              {reviewHighlightedIndex === 1 ? '› ' : '  '}2. Cancel
            </Text>
          </Box>
        </Box>
      </PromptContainer>
    );
  }

  return (
    <PromptContainer>

      {/* Stepper progress bar */}
      <StepperProgress
        questions={questions}
        currentIndex={currentQuestionIndex}
        answers={answers}
      />

      {/* Question text */}
      <Box marginBottom={1}>
        <Text>{currentQuestion.question}</Text>
      </Box>

      {/* Options list */}
      <Box flexDirection="column">
        {items.map((item, index) => renderItem(item, index))}
      </Box>
    </PromptContainer>
  );
}

export default ClarifyingQuestionsPrompt;
