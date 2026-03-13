import { GoogleGenAI, Type } from "@google/genai";
import { MacroEstimation, Recipe, UserProfile, Meal, RecipeFilters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const estimateMealMacros = async (description: string): Promise<MacroEstimation> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `You are a nutrition calculator. Estimate calories, protein, carbs, and fat for the following meal: "${description}". Return ONLY a JSON object with keys: calories, protein, carbs, fat.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER }
        },
        required: ["calories", "protein", "carbs", "fat"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const analyzeMealImage = async (base64Image: string, isLabel: boolean): Promise<{ description: string, macros: MacroEstimation }> => {
  const prompt = isLabel 
    ? "Extract nutrition information from this label. Return a description of the product and the macros (calories, protein, carbs, fat) per serving. If multiple servings, use per serving values."
    : "Analyze this meal photo. Detect all visible food items, estimate portion sizes, and provide a combined description. Estimate total calories, protein, carbs, and fat for the entire meal shown.";

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
          description: { type: Type.STRING },
          macros: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fat: { type: Type.NUMBER }
            },
            required: ["calories", "protein", "carbs", "fat"]
          }
        },
        required: ["description", "macros"]
      }
    }
  });

  return JSON.parse(response.text);
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

  return JSON.parse(response.text);
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

  return response.text;
};
