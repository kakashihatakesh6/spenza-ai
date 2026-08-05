// @ts-nocheck
import { tool } from 'npm:@langchain/core/tools';
import { z } from 'npm:zod@^3.22.4';
import { Logger } from '../observability.ts';

export function createUserProfileTools(supabaseClient: any, userId: string, onLog?: (entry: any) => void) {
  const getProfileTool = tool(
    async () => {
      const startTime = Date.now();
      try {
        Logger.info(`[GetUserProfileTool] Fetching profile for user: ${userId}`);
        const { data: userData, error: getUserErr } = await supabaseClient.auth.getUser();
        if (getUserErr || !userData?.user) {
          throw new Error(`Failed to retrieve user profile: ${getUserErr?.message || 'User not found'}`);
        }

        const currentMetadata = userData.user.user_metadata || {};
        const profile = {
          displayName: currentMetadata.username || currentMetadata.full_name || userData.user.email?.split('@')[0] || 'User',
          email: userData.user.email,
          monthlyIncome: currentMetadata.monthly_income ?? currentMetadata.income ?? null,
          preferredCurrency: currentMetadata.preferred_currency ?? currentMetadata.currency ?? 'INR',
          language: currentMetadata.language ?? 'English',
          timezone: currentMetadata.timezone ?? 'UTC',
          preferences: currentMetadata.bio ?? currentMetadata.profile_preferences ?? 'None',
          budgetsCount: Array.isArray(currentMetadata.budgets) ? currentMetadata.budgets.length : 0
        };

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'get_user_profile', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: true, profile });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[GetUserProfileTool Error]`, err);
        onLog?.({ toolName: 'get_user_profile', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to get profile.' });
      }
    },
    {
      name: 'get_user_profile',
      description: 'Fetch the authenticated user profile information including display name, email, monthly income, preferred currency, language, timezone, and preferences.',
      schema: z.object({})
    }
  );

  const updateProfileTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[UpdateUserProfileTool] Updating profile for user: ${userId}`, input);
        const { data: userData, error: getUserErr } = await supabaseClient.auth.getUser();
        if (getUserErr || !userData?.user) {
          throw new Error(`Failed to retrieve user profile: ${getUserErr?.message || 'User not found'}`);
        }

        const currentMetadata = userData.user.user_metadata || {};
        const updatedMetadata = { ...currentMetadata };
        const updatedFields: string[] = [];

        if (input.displayName !== undefined) {
          updatedMetadata.username = input.displayName.trim();
          updatedMetadata.full_name = input.displayName.trim();
          updatedFields.push(`displayName: "${input.displayName.trim()}"`);
        }

        if (input.monthlyIncome !== undefined) {
          updatedMetadata.monthly_income = input.monthlyIncome;
          updatedMetadata.income = input.monthlyIncome;
          updatedFields.push(`monthlyIncome: ${input.monthlyIncome}`);
        }

        if (input.preferredCurrency !== undefined) {
          updatedMetadata.preferred_currency = input.preferredCurrency.toUpperCase().trim();
          updatedMetadata.currency = input.preferredCurrency.toUpperCase().trim();
          updatedFields.push(`preferredCurrency: "${input.preferredCurrency.toUpperCase().trim()}"`);
        }

        if (input.language !== undefined) {
          updatedMetadata.language = input.language.trim();
          updatedFields.push(`language: "${input.language.trim()}"`);
        }

        if (input.timezone !== undefined) {
          updatedMetadata.timezone = input.timezone.trim();
          updatedFields.push(`timezone: "${input.timezone.trim()}"`);
        }

        if (input.preferences !== undefined) {
          updatedMetadata.bio = input.preferences.trim();
          updatedMetadata.profile_preferences = input.preferences.trim();
          updatedFields.push(`preferences: "${input.preferences.trim()}"`);
        }

        if (updatedFields.length === 0) {
          return JSON.stringify({ success: false, message: 'No profile fields provided to update.' });
        }

        const { error: updateErr } = await supabaseClient.auth.updateUser({
          data: updatedMetadata
        });

        if (updateErr) {
          throw new Error(`Failed to update user profile: ${updateErr.message}`);
        }

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'update_user_profile', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });

        return JSON.stringify({
          success: true,
          message: `User profile updated successfully. Updated fields: ${updatedFields.join(', ')}`,
          updatedProfile: {
            displayName: updatedMetadata.username,
            monthlyIncome: updatedMetadata.monthly_income,
            preferredCurrency: updatedMetadata.preferred_currency,
            language: updatedMetadata.language,
            timezone: updatedMetadata.timezone,
            preferences: updatedMetadata.bio
          }
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[UpdateUserProfileTool Error]`, err);
        onLog?.({ toolName: 'update_user_profile', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to update profile.' });
      }
    },
    {
      name: 'update_user_profile',
      description: 'Update authenticated user profile information such as display name / username, monthly income, preferred currency (e.g. USD, INR, EUR), language, timezone, or personal preferences/bio.',
      schema: z.object({
        displayName: z.string().optional().describe('New display name / username for the user'),
        monthlyIncome: z.number().optional().describe('New monthly income amount'),
        preferredCurrency: z.string().optional().describe('Preferred currency code, e.g. USD, INR, EUR'),
        language: z.string().optional().describe('Preferred language'),
        timezone: z.string().optional().describe('User timezone, e.g. Asia/Kolkata, UTC'),
        preferences: z.string().optional().describe('Other profile preferences or personal bio')
      })
    }
  );

  return [getProfileTool, updateProfileTool];
}
