'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  useActionState,
} from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUser } from '@/contexts/UserContext'
import type { UserSettings } from '@/api/sargo/interfaces/user'
import {
  WIND_SPEED_OPTIONS,
  HEIGHT_OPTIONS,
  TEMPERATURE_OPTIONS,
} from '@/constants/units'
import { CONFIG } from '@/constants/config'
import {
  updatePassword,
  updateUsername,
  updateUserSettings,
  type UpdatePasswordState,
  type UpdateUsernameState,
} from '@/api/sargo/actions/user'
import { hasDevModeAccess, normalizeUserSettings } from '@/lib/userSettings'
import { useDebouncedSettingsSave } from '@/hooks/useDebouncedSettingsSave'
import { cn } from '@/lib/utils'

type SettingsTab = 'general' | 'account' | 'units'
type AccountEdit = 'username' | 'password' | null

const SETTINGS_TABS = [
  { value: 'general', label: 'General' },
  { value: 'account', label: 'Account' },
  { value: 'units', label: 'Units' },
] as const satisfies readonly { value: SettingsTab; label: string }[]

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const SETTINGS_TAB_FOCUS =
  'focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

const UNIT_SETTINGS = [
  { key: 'wind_speed', label: 'Wind speed', options: WIND_SPEED_OPTIONS },
  { key: 'surf_height', label: 'Surf height', options: HEIGHT_OPTIONS },
  { key: 'swell_height', label: 'Swell height', options: HEIGHT_OPTIONS },
  { key: 'tide_height', label: 'Tide height', options: HEIGHT_OPTIONS },
  { key: 'temperature', label: 'Temperature', options: TEMPERATURE_OPTIONS },
] as const satisfies readonly {
  key: keyof UserSettings['units']
  label: string
  options: readonly { value: string; label: string }[]
}[]

export function SettingsForm(): React.JSX.Element {
  const { userData, updateUser } = useUser()
  const { theme, setTheme } = useTheme()
  const normalizedSettings = normalizeUserSettings(userData.settings)
  const [username, setUsername] = useState(userData.username)
  const [tab, setTab] = useState<SettingsTab>('general')
  const [edit, setEdit] = useState<AccountEdit>(null)
  const [themeMounted, setThemeMounted] = useState(false)
  const [isDevModeSaving, setIsDevModeSaving] = useState(false)
  const {
    handleUnitChange,
    commitSettings,
    getWorkingSettings,
    syncPersistedSettings,
  } = useDebouncedSettingsSave(normalizedSettings, updateUser)

  const units = normalizedSettings.units
  const devModeEnabled = normalizedSettings.camObserverEnabled
  const initial = (username || userData.email).charAt(0).toUpperCase()

  // Defer the first paint a frame so we don't set state synchronously in the
  // effect body (matches the rAF pattern used elsewhere in the app).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setThemeMounted(true))
    return (): void => cancelAnimationFrame(raf)
  }, [])

  const handleUsernameSuccess = useCallback(
    (newUsername: string): void => {
      setUsername(newUsername)
      updateUser({ username: newUsername })
      toast.success('Username updated!')
      setEdit(null)
    },
    [updateUser]
  )

  const handlePasswordSuccess = useCallback((): void => {
    toast.success('Password changed!')
    setEdit(null)
  }, [])

  const handleDevModeChange = (enabled: boolean): void => {
    const previous = getWorkingSettings()
    const newSettings = normalizeUserSettings({
      ...previous,
      camObserverEnabled: enabled,
    })

    commitSettings(newSettings)
    setIsDevModeSaving(true)

    updateUserSettings(newSettings)
      .then((result) => {
        if (!result.success) {
          commitSettings(previous)
          toast.error(result.error || 'Settings could not be saved')
          return
        }

        const persisted = normalizeUserSettings(result.settings ?? newSettings)
        syncPersistedSettings(persisted)
        commitSettings(persisted)
        toast.success(enabled ? 'Dev mode enabled' : 'Dev mode disabled')
      })
      .catch((error) => {
        commitSettings(previous)
        toast.error(
          error instanceof Error ? error.message : 'Settings could not be saved'
        )
      })
      .finally(() => {
        setIsDevModeSaving(false)
      })
  }

  return (
    <>
      <div className="flex flex-col sm:max-h-[min(32rem,85dvh)] sm:flex-row sm:overflow-hidden">
        <aside className="flex shrink-0 flex-col gap-3 border-b bg-muted/50 p-5 pb-3 sm:w-52 sm:gap-3.25 sm:border-r sm:border-b-0">
          <DialogTitle className="font-semibold">Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Manage your account, appearance, and forecast preferences.
          </DialogDescription>
          <nav className="flex gap-1 sm:flex-col">
            {SETTINGS_TABS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                aria-current={tab === value ? 'page' : undefined}
                className={cn(
                  'shrink-0 justify-start hover:bg-foreground/3 dark:hover:bg-foreground/3',
                  SETTINGS_TAB_FOCUS,
                  tab === value && 'pointer-events-none bg-foreground/6'
                )}
                onClick={() => setTab(value)}
              >
                {label}
              </Button>
            ))}
          </nav>
        </aside>

        <div className="grid min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 sm:pt-14">
          <div
            inert={tab !== 'general'}
            className={cn(
              'col-start-1 row-start-1',
              tab !== 'general' && 'pointer-events-none opacity-0'
            )}
          >
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel>Appearance</FieldLabel>
                  <FieldDescription>
                    Choose how Sea Prophet looks to you.
                  </FieldDescription>
                </FieldContent>
                {themeMounted ? (
                  <Tabs
                    value={theme || CONFIG.defaultTheme}
                    onValueChange={(value) =>
                      setTheme(value as 'light' | 'dark' | 'system')
                    }
                  >
                    <TabsList>
                      <TooltipProvider>
                        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                          <Tooltip key={value}>
                            <TooltipTrigger
                              render={
                                <TabsTrigger
                                  value={value}
                                  aria-label={label}
                                  className={SETTINGS_TAB_FOCUS}
                                />
                              }
                            >
                              <Icon />
                            </TooltipTrigger>
                            <TooltipContent sideOffset={12}>
                              {label}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </TabsList>
                  </Tabs>
                ) : null}
              </Field>

              {hasDevModeAccess(userData) ? (
                <>
                  <FieldSeparator />
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="dev-mode">Dev mode</FieldLabel>
                      <FieldDescription>
                        Enable experimental features.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="dev-mode"
                      checked={devModeEnabled}
                      disabled={isDevModeSaving}
                      onCheckedChange={handleDevModeChange}
                    />
                  </Field>
                </>
              ) : null}
            </FieldGroup>
          </div>
          <div
            inert={tab !== 'account'}
            className={cn(
              'col-start-1 row-start-1',
              tab !== 'account' && 'pointer-events-none opacity-0'
            )}
          >
            <FieldGroup>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="font-semibold text-popover-foreground">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {username}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userData.email}
                  </span>
                </div>
              </div>

              <FieldSeparator />
              <Field orientation="horizontal">
                <FieldLabel htmlFor="newPassword">Username</FieldLabel>
                <div className="flex items-center gap-4">
                  {username}
                  <Button variant="outline" onClick={() => setEdit('username')}>
                    Change
                  </Button>
                </div>
              </Field>
              <FieldSeparator />
              <Field orientation="horizontal">
                <FieldLabel htmlFor="newPassword">Password</FieldLabel>
                <div className="flex items-center gap-4">
                  <span className="tracking-widest">••••••••</span>
                  <Button variant="outline" onClick={() => setEdit('password')}>
                    Change
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </div>
          <div
            inert={tab !== 'units'}
            className={cn(
              'col-start-1 row-start-1',
              tab !== 'units' && 'pointer-events-none opacity-0'
            )}
          >
            <FieldGroup>
              {UNIT_SETTINGS.map(({ key, label, options }, index) => (
                <Fragment key={key}>
                  {index > 0 ? <FieldSeparator /> : null}
                  <Field orientation="horizontal">
                    <FieldLabel>{label}</FieldLabel>
                    <Tabs
                      value={units[key]}
                      onValueChange={(value) => handleUnitChange(key, value)}
                    >
                      <TabsList>
                        {options.map((option) => (
                          <TabsTrigger
                            key={option.value}
                            value={option.value}
                            className={SETTINGS_TAB_FOCUS}
                          >
                            {option.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </Field>
                </Fragment>
              ))}
            </FieldGroup>
          </div>
        </div>
      </div>

      <Dialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open) setEdit(null)
        }}
      >
        <DialogContent className="max-w-[min(24rem,calc(90%-1.8rem))] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {edit === 'password' ? 'Change password' : 'Change username'}
            </DialogTitle>
          </DialogHeader>

          {edit === 'username' ? (
            <UsernameEditForm
              username={username}
              onSuccess={handleUsernameSuccess}
            />
          ) : null}

          {edit === 'password' ? (
            <PasswordEditForm onSuccess={handlePasswordSuccess} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function UsernameEditForm({
  username,
  onSuccess,
}: {
  username: string
  onSuccess: (username: string) => void
}): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateUsernameState,
    FormData
  >(updateUsername, null)

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      onSuccess(state.username)
    }
  }, [state, onSuccess])

  return (
    <form action={formAction} aria-busy={isPending}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            name="username"
            defaultValue={username}
            autoComplete="username"
            required
            disabled={isPending}
          />
        </Field>
        {state && 'error' in state && state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <button
            type="submit"
            disabled={isPending}
            className={cn(buttonVariants())}
          >
            {isPending ? (
              <>
                <Spinner />
                Updating…
              </>
            ) : (
              'Update username'
            )}
          </button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

function PasswordEditForm({
  onSuccess,
}: {
  onSuccess: () => void
}): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdatePasswordState,
    FormData
  >(updatePassword, null)

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      onSuccess()
    }
  }, [state, onSuccess])

  return (
    <form action={formAction} aria-busy={isPending}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={isPending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={isPending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">
            Confirm new password
          </FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={isPending}
          />
        </Field>
        {state && 'error' in state && state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <button
            type="submit"
            disabled={isPending}
            className={cn(buttonVariants())}
          >
            {isPending ? (
              <>
                <Spinner />
                Updating…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}
