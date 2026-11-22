import { Navigate, Route, Routes } from 'react-router-dom';
import { ActivitiesList } from './components/ActivitiesList';
import { Layout } from './components/Layout';
import { GuestRoute } from './components/GuestRoute';
import { ProtectedRoute } from './components/ProtectedRoutes';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Home } from './components/Home';
import { Chat } from './components/Chat';
import { ActivityForm } from './components/ActivityForm';
import { UsersList } from './components/UserList';
import { UserForm } from './components/UserForm';
import { ReportsList } from './components/ReportsList';
import { ReportForm } from './components/ReportForm';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/activities" element={<ActivitiesList />} />
          <Route path="/reports/new" element={<ReportForm />} />
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN', 'STORE_HOST']} />}>
          <Route path="/activities/new" element={<ActivityForm />} />
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/users" element={<UsersList />} />
          <Route path="/users/new" element={<UserForm />} />
          <Route path="/users/:id/edit" element={<UserForm />} />
          <Route path="/activities/:id/edit" element={<ActivityForm />} />
          <Route path="/reports" element={<ReportsList />} />
          <Route path="/reports/:id/edit" element={<ReportForm />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}