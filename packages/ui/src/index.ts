import { Navbar } from "./Layout/Navbar";
import { DottedLine } from "./Vectors/DottedLine";
import { GlitchText } from "./Animations/GlitchText";
import { ExplainContainer } from "./Animations/ExplainContainer";
import { StarExplain } from "./Animations/StarExplain";
import { CodeTyping } from "./Animations/CodeTyping";
import { HorizontalRoots } from "./Animations/HorizontalRoots";
import { FlyingThroughSpace } from "./Animations/FlyingThroughSpace";
import { GoldenSpiral } from "./Animations/GoldenSpiral";
import { SpiralGalaxy } from "./Animations/SpiralGalaxy";
import { FractalOrb } from "./Animations/FractalOrb";
import { CrystallineRefraction } from "./Animations/CrystallineRefraction";
import { ButtonHeavyRight } from "./Buttons/ButtonHeavyRight";
import { RoundContainer } from "./Buttons/RoundContainer";
import { ButtonHeavyLeft } from "./Buttons/ButtonHeavyLeft";
import { ButtonSleek } from "./Buttons/ButtonSleek";
import { LinkButton } from "./Buttons/LinkButton";
import { SearchDropdown } from "./Elements/SearchDropdown";
import { SearchInput } from "./Elements/SearchInput";
import { IconComp } from "./Elements/IconComp";
import { TextComp } from "./Elements/TextComp";
import { SeparatorLine } from "./Vectors/SeparatorLine";
import { PageExoskeleton } from "./Vectors/PageExoskeleton";
import { ProfileIcon } from "./Vectors/ProfileIcon";
import { PublicIcon } from "./Vectors/PublicIcon";
import { PrivateIcon } from "./Vectors/PrivateIcon";
import { HeartFilledIcon } from "./Vectors/HeartFilledIcon";
import { HeartStrokeIcon } from "./Vectors/HeartStrokeIcon";
import { StyleThree } from "./Vectors/LineContainer/StyleThree";
import { StyleTwo } from "./Vectors/LineContainer/StyleTwo";
import { StyleOne } from "./Vectors/LineContainer/StyleOne";
import { SineWaves } from "./Animations/SineWaves";
import { WaveformLoader } from "./Animations/WaveformLoader";
import { ContourSphere } from "./Animations/ContourSphere";
import { Remains } from "./Animations/Remains";
import { RockRing } from "./Animations/RockRing";
import { Terrain } from "./Animations/Terrain";
import { NebulaField } from "./Backgrounds/NebulaField";
import { VoidField } from "./Backgrounds/VoidField";
import { Tunnel } from "./Animations/Tunnel";
import { MobileNavbar } from "./Layout/MobileNavbar";
import { ToggleButton } from "./Buttons/ToggleButton";
import { IconButton } from "./Buttons/IconButton";
import { HoverFlow } from "./Animations/HoverFlow";
import { InfoPageLayout } from "./Layout/InfoPageLayout";
import GlobalFooter from "./Layout/GlobalFooter";
import GlobalMobileFooter from "./Layout/GlobalMobileFooter";
import { SideLines } from "./Layout/SideLines";
import ErrorContent from "./Content/ErrorContent";
import Error404 from "./Content/Error404";
import ContactContent from "./Content/ContactContent";
import { FeedbackForm } from "./Content/FeedbackForm";
import { WelcomeMessage } from "./Layout/WelcomeMessage";
import { TermsAcceptance } from "./Layout/TermsAcceptance";
import { Tooltip } from "./Layout/Tooltip";
import { StatusMessage } from "./Elements/StatusMessage";
import { StatusModal } from "./Modals/StatusModal";
import { ConfirmModal } from "./Modals/ConfirmModal";
import { InputModal } from "./Modals/InputModal";
// Unified modal system — one shell (Dialog) + three patterns. Everything that pops over the page
// should compose these; the older StatusMessage / StatusModal / ConfirmModal / InputModal remain
// only until their call sites are migrated.
import { Dialog } from "./Modals/Dialog";
import { StatusDialog } from "./Modals/StatusDialog";
import { ConfirmDialog } from "./Modals/ConfirmDialog";
import { PromptDialog } from "./Modals/PromptDialog";

export type {
  DialogProps,
  DialogAction,
  DialogActionTone,
  DialogSize,
} from "./Modals/Dialog";
export type { StatusDialogProps, StatusKind } from "./Modals/StatusDialog";
export type { ConfirmDialogProps } from "./Modals/ConfirmDialog";
export type { PromptDialogProps } from "./Modals/PromptDialog";
import { FormInput } from "./Elements/FormInput";
import { PasswordInput } from "./Elements/PasswordInput";
import { FormError } from "./Elements/FormError";
import { AuthStatusBanner } from "./Elements/AuthStatusBanner";
import { DemoStageBanner } from "./Elements/DemoStageBanner";
import { CartIcon } from "./Elements/CartIcon";
import { ProfileDropdown } from "./Elements/ProfileDropdown";
import LoginContent from "./Content/LoginContent";
import { GoogleSignInButton } from "./Auth/GoogleSignInButton";
import { GoogleOneTap } from "./Auth/GoogleOneTap";
import { PlanBillingCard } from "./Billing/PlanBillingCard";
import { ConsumerPricingContent } from "./Billing/ConsumerPricingContent";
import { PartnerPricingContent } from "./Billing/PartnerPricingContent";
import { PricingContent } from "./Billing/PricingContent";
import RegisterContent from "./Content/RegisterContent";
import ForgotPasswordContent from "./Content/ForgotPasswordContent";
import ResetPasswordContent from "./Content/ResetPasswordContent";
import VerifyEmailContent from "./Content/VerifyEmailContent";
import Verify2FAContent from "./Content/Verify2FAContent";
import ProfileContent from "./Content/ProfileContent";
// Shared auth-screen building blocks — the frame, the terminal-state body, and the password
// checklist. Every auth page composes these instead of hand-rolling its own chrome.
import { AuthScreen } from "./Content/AuthScreen";
import { AuthDone } from "./Content/AuthDone";
import { PasswordRequirements } from "./Content/PasswordRequirements";
export type { AuthScreenProps } from "./Content/AuthScreen";
export type { AuthDoneProps, AuthDoneTone } from "./Content/AuthDone";
export type { PasswordRequirement } from "./Content/PasswordRequirements";
// Profile-screen chrome, so app-supplied panels (webapp's LinkedAccounts) match the page exactly.
export * from "./Content/pageChrome";
import ChangePasswordContent from "./Content/ChangePasswordContent";
import SessionsContent from "./Content/SessionsContent";
import { fetchSessionId, fetchGenerationTime } from "./utils/fetching";
export * from "./design-system";

export {
  Navbar,
  DottedLine,
  GlitchText,
  ExplainContainer,
  StarExplain,
  CodeTyping,
  HorizontalRoots,
  FlyingThroughSpace,
  GoldenSpiral,
  SpiralGalaxy,
  FractalOrb,
  CrystallineRefraction,
  ButtonHeavyRight,
  RoundContainer,
  ButtonHeavyLeft,
  ButtonSleek,
  LinkButton,
  SearchDropdown,
  SearchInput,
  IconComp,
  TextComp,
  SeparatorLine,
  PageExoskeleton,
  StyleThree,
  StyleTwo,
  StyleOne,
  SineWaves,
  WaveformLoader,
  ContourSphere,
  Remains,
  RockRing,
  Terrain,
  NebulaField,
  Tunnel,
  MobileNavbar,
  ToggleButton,
  GlobalFooter,
  GlobalMobileFooter,
  IconButton,
  HoverFlow,
  InfoPageLayout,
  SideLines,
  ErrorContent,
  ContactContent,
  Error404,
  WelcomeMessage,
  TermsAcceptance,
  Tooltip,
  FeedbackForm,
  StatusMessage,
  StatusModal,
  ConfirmModal,
  InputModal,
  Dialog,
  StatusDialog,
  ConfirmDialog,
  PromptDialog,
  // Auth components
  FormInput,
  PasswordInput,
  FormError,
  AuthStatusBanner,
  DemoStageBanner,
  LoginContent,
  GoogleSignInButton,
  GoogleOneTap,
  PlanBillingCard,
  ConsumerPricingContent,
  PartnerPricingContent,
  PricingContent,
  RegisterContent,
  ForgotPasswordContent,
  ResetPasswordContent,
  VerifyEmailContent,
  Verify2FAContent,
  ProfileContent,
  ChangePasswordContent,
  SessionsContent,
  AuthScreen,
  AuthDone,
  PasswordRequirements,
  // Vectors
  ProfileIcon,
  PublicIcon,
  PrivateIcon,
  HeartFilledIcon,
  HeartStrokeIcon,
  // Cart
  CartIcon,
  ProfileDropdown,
  VoidField,
  fetchSessionId,
  fetchGenerationTime,
};
