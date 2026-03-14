import { GoogleGenAI, Type } from "@google/genai";
import { MacroEstimation, Recipe, UserProfile, Meal, RecipeFilters, WeeklyReport } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const parseMealInput = async (description: string): Promise<{ cleanedName: string, items: string[] }> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Analyze this meal description: "${description}". 
    1. Provide a proper, clean, and descriptive combined name for the meal.
    2. Split the meal into individual food items with their quantities/portions.
    Return ONLY a JSON object with keys: cleanedName (string), items (array of strings).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cleanedName: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["cleanedName", "items"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export interface ParsedItemMacro {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const estimateItemsMacros = async (items: string[]): Promise<ParsedItemMacro[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Estimate calories, protein, carbs, and fat for each of the following food items: ${JSON.stringify(items)}. 
    Return an array of JSON objects, each with keys: name (string), calories (number), protein (number), carbs (number), fat (number).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fat: { type: Type.NUMBER }
          },
          required: ["name", "calories", "protein", "carbs", "fat"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const analyzeMealImageForItems = async (base64Image: string, isLabel: boolean): Promise<{ cleanedName: string, items: string[] }> => {
  const prompt = isLabel 
    ? "Extract nutrition information from this label. Return a proper, clean product name and a list of items (usually just one item with its serving size)."
    : "Analyze this meal photo. Detect all visible food items, estimate portion sizes. Provide a proper, clean combined name for the meal, and a list of individual food items with their quantities.";

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image.split(',')[1] || base64Image
        }
      },
      { text: prompt }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cleanedName: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["cleanedName", "items"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateRecipesFromPantry = async (
  ingredients: string[], 
  filters: RecipeFilters, 
  profile: UserProfile,
  remainingMacros?: MacroEstimation
): Promise<Recipe[]> => {
  const macroContext = remainingMacros 
    ? `The user has ${remainingMacros.calories}kcal, ${remainingMacros.protein}g protein, ${remainingMacros.carbs}g carbs, and ${remainingMacros.fat}g fat remaining for the day. Prioritize recipes that fit these targets.`
    : `The user's goal is ${profile.fitnessGoal}.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `I have the following ingredients: ${ingredients.join(", ")}. 
    Generate 3 healthy recipes I can cook.
    
    Filters:
    - Dietary: ${filters.dietary.join(", ") || "None"}
    - Cuisine: ${filters.cuisine || "Any"}
    - Max Prep Time: ${filters.maxTime} minutes
    - Meal Category: ${filters.mealType || "Standard Meal"}
    - Additional Instructions: ${filters.customInstructions || "None"}
    
    Context:
    ${macroContext}
    
    Return a JSON array of objects with:
    - title (string)
    - ingredients (array of strings with measurements)
    - instructions (array of strings)
    - macros (object with calories, protein, carbs, fat)
    - prepTime (string, e.g. "25 mins")
    - mealPrepTips (string, optional)
    - substitutions (array of strings, optional)
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            macros: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER }
              }
            },
            prepTime: { type: Type.STRING },
            mealPrepTips: { type: Type.STRING },
            substitutions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "ingredients", "instructions", "macros", "prepTime"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const getWeeklyCoaching = async (profile: UserProfile, meals: Meal[]): Promise<string> => {
  const mealSummary = meals.map(m => `${m.timestamp}: ${m.description} (${m.calories}kcal, P:${m.protein}g)`).join("\n");
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `You are a professional dietitian. Analyze the following 7-day nutrition data for a user with goal: ${profile.fitnessGoal}. 
    User Profile: Age ${profile.age}, Weight ${profile.weight}kg, Height ${profile.height}cm.
    Targets: ${profile.calorieTarget}kcal, ${profile.proteinTarget}g Protein.
    
    Meal Data:
    ${mealSummary}
    
    Provide a concise, actionable summary (max 200 words) like a dietitian would. Focus on consistency, protein intake, and progress towards their goal.`,
    config: {
      systemInstruction: "You are a helpful AI Nutrition Coach. Be encouraging but data-driven."
    }
  });

  return response.text || "Unable to generate coaching summary at this time.";
};

export const chatWithAssistant = async (message: string, context: { profile: UserProfile, pantry: string[], todayMeals: Meal[] }) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `User: ${message}
    
    Context:
    - Goal: ${context.profile.fitnessGoal}
    - Pantry: ${context.pantry.join(", ")}
    - Today's Meals: ${context.todayMeals.map(m => m.description).join(", ")}`,
    config: {
      systemInstruction: "You are MacroLog AI, a personal nutrition assistant. Help the user with meal ideas, macro advice, and nutrition questions. Keep responses concise and actionable."
    }
  });

  return response.text || "I'm sorry, I couldn't generate a response.";
};

export const getMealSuggestions = async (remaining: MacroEstimation, profile: UserProfile): Promise<Recipe[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `The user has the following macros remaining for today: 
    Calories: ${remaining.calories}kcal, Protein: ${remaining.protein}g, Carbs: ${remaining.carbs}g, Fat: ${remaining.fat}g.
    User Goal: ${profile.fitnessGoal}.
    
    Suggest 3-5 meal ideas that help the user reach these targets. 
    Focus on filling the gaps (e.g., if protein is low, suggest high-protein meals).
    
    Return a JSON array of objects with:
    - title (string)
    - ingredients (array of strings)
    - instructions (array of strings)
    - macros (object with calories, protein, carbs, fat)
    - prepTime (string)
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            macros: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER }
              }
            },
            prepTime: { type: Type.STRING }
          },
          required: ["title", "ingredients", "instructions", "macros", "prepTime"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const getWeeklyInsights = async (reportData: Partial<WeeklyReport>, profile: UserProfile): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analyze this weekly nutrition report for a user with goal: ${profile.fitnessGoal}.
    Averages: ${reportData.avgCalories}kcal, ${reportData.avgProtein}g Protein, ${reportData.avgCarbs}g Carbs, ${reportData.avgFat}g Fat.
    Avg Diet Score: ${reportData.avgDietScore}/100.
    Targets Met: Protein ${reportData.daysProteinTargetMet}/7 days, Calories ${reportData.daysCalorieTargetMet}/7 days.
    Best Score: ${reportData.bestDietScore}, Worst Score: ${reportData.worstDietScore}.
    
    Provide 2-3 concise, actionable insights or encouraging comments.`,
    config: {
      systemInstruction: "You are a professional AI Nutrition Coach. Be concise, data-driven, and encouraging."
    }
  });

  return response.text || "Keep up the great work!";
};
